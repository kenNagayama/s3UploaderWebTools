from aws_cdk import (
    Stack,
    aws_s3 as s3,
    aws_lambda as lambda_,
    RemovalPolicy,
    CfnOutput,
    aws_glue as glue,
    aws_iam as iam,
    aws_s3_notifications as s3n,
    Duration
)
from constructs import Construct
import os


class BackendStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # ==========================================
        # CI/CD: GitHub Actions OIDC Provider & Role
        # ==========================================
        # Note: AWSアカウント内に手動等で既に同名のOIDCプロバイダが存在する場合は
        # デプロイ時に競合エラーとなる可能性があります。
        github_domain = "token.actions.githubusercontent.com"
        
        oidc_provider = iam.OpenIdConnectProvider(
            self,
            "GitHubOIDCProvider",
            url=f"https://{github_domain}",
            client_ids=["sts.amazonaws.com"],
        )

        github_role = iam.Role(
            self,
            "GitHubActionsDeployRole",
            role_name="GitHubActionsDeployRole-S3Uploader",
            assumed_by=iam.OpenIdConnectPrincipal(
                oidc_provider,
                conditions={
                    "StringLike": {
                        f"{github_domain}:sub": "repo:kenNagayama/s3UploaderWebTools:*"
                    },
                    "StringEquals": {
                        f"{github_domain}:aud": "sts.amazonaws.com"
                    }
                }
            )
        )
        github_role.add_managed_policy(
            iam.ManagedPolicy.from_aws_managed_policy_name("AdministratorAccess")
        )
        
        CfnOutput(self, "GitHubActionsRoleArn", value=github_role.role_arn)

        # ==========================================
        # 1. Create S3 Bucket (Raw Data / Upload Bucket) with CORS
        # ==========================================
        bucket = s3.Bucket(

            self,
            "DataUploadBucket",
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
            versioned=True,
            lifecycle_rules=[
                s3.LifecycleRule(
                    noncurrent_version_expiration=Duration.days(30),
                    abort_incomplete_multipart_upload_after=Duration.days(7)
                )
            ],
            cors=[
                s3.CorsRule(
                    allowed_methods=[
                        s3.HttpMethods.PUT,
                        s3.HttpMethods.POST,
                        s3.HttpMethods.GET,
                        s3.HttpMethods.HEAD,
                        s3.HttpMethods.DELETE,
                    ],
                    allowed_origins=[
                        "*"
                    ],  # In production, restrict to specific domains
                    allowed_headers=["*"],
                    exposed_headers=["ETag"],
                    max_age=3000,
                )
            ],
        )

        # 2. Create S3 Bucket (Clean Data / Athena Bucket)
        athena_data_bucket = s3.Bucket(
            self,
            "AthenaDataBucket",
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
            versioned=True,
            lifecycle_rules=[
                s3.LifecycleRule(
                    noncurrent_version_expiration=Duration.days(30),
                    abort_incomplete_multipart_upload_after=Duration.days(7)
                )
            ],
        )

        # 3. Create Lambda handling presigned URLs
        handler = lambda_.Function(
            self,
            "PresignedUrlHandler",
            runtime=lambda_.Runtime.PYTHON_3_13,
            code=lambda_.Code.from_asset("lambda"),
            handler="handler.handler",
            environment={"BUCKET_NAME": bucket.bucket_name},
        )

        bucket.grant_put(handler)
        bucket.grant_read(handler)
        bucket.grant_delete(handler)

        fn_url = handler.add_function_url(
            auth_type=lambda_.FunctionUrlAuthType.NONE,
            cors=lambda_.FunctionUrlCorsOptions(
                allowed_origins=["*"],
                allowed_methods=[lambda_.HttpMethod.ALL],
                allowed_headers=["*"],
            ),
        )

        # 4. Create Transform Lambda
        transform_handler = lambda_.Function(
            self,
            "CsvTransformHandler",
            runtime=lambda_.Runtime.PYTHON_3_13,
            code=lambda_.Code.from_asset("lambda"),
            handler="transform_handler.handler",
            environment={
                "SOURCE_BUCKET": bucket.bucket_name,
                "DEST_BUCKET": athena_data_bucket.bucket_name
            },
            memory_size=1024,
            timeout=Duration.minutes(5)
        )

        bucket.grant_read(transform_handler)
        athena_data_bucket.grant_put(transform_handler)

        bucket.add_event_notification(
            s3.EventType.OBJECT_CREATED,
            s3n.LambdaDestination(transform_handler),
            s3.NotificationKeyFilter(prefix="tableau-access/", suffix=".csv")
        )

        # ==========================================
        # Athena & Glue Resources for Tableau Access
        # ==========================================

        # 5. Athena Query Results Bucket
        athena_results_bucket = s3.Bucket(
            self,
            "AthenaResultsBucket",
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
        )

        # 6. Glue Database
        database_name = "tableau_access_db"
        glue_db = glue.CfnDatabase(
            self,
            "TableauAccessDatabase",
            catalog_id=self.account,
            database_input=glue.CfnDatabase.DatabaseInputProperty(
                name=database_name,
                description="Database for Tableau to query S3 CSVs via Athena"
            )
        )

        # 7. Glue Table (No Partitions for Full Extract capability)
        table_name = "twins_digital_data"
        glue_table = glue.CfnTable(
            self,
            "TableauAccessTable",
            catalog_id=self.account,
            database_name=database_name,
            table_input=glue.CfnTable.TableInputProperty(
                name=table_name,
                table_type="EXTERNAL_TABLE",
                parameters={
                    "skip.header.line.count": "3",
                    "classification": "csv",
                    "use.null.for.invalid.data": "true"
                },
                storage_descriptor=glue.CfnTable.StorageDescriptorProperty(
                    location=f"s3://{athena_data_bucket.bucket_name}/tableau-access/",
                    input_format="org.apache.hadoop.mapred.TextInputFormat",
                    output_format="org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat",
                    serde_info=glue.CfnTable.SerdeInfoProperty(
                        serialization_library="org.apache.hadoop.hive.serde2.OpenCSVSerde",
                        parameters={
                            "separatorChar": ",",
                            "quoteChar": "\"",
                            "escapeChar": "\\\\"
                        }
                    ),
                    columns=[
                        # Columns from the spec
                        glue.CfnTable.ColumnProperty(name="no", type="int"),
                        glue.CfnTable.ColumnProperty(name="測定年", type="int"),
                        glue.CfnTable.ColumnProperty(name="年内通番", type="int"),
                        glue.CfnTable.ColumnProperty(name="支社コード", type="string"),
                        glue.CfnTable.ColumnProperty(name="技セコード", type="string"),
                        glue.CfnTable.ColumnProperty(name="メセコード", type="string"),
                        glue.CfnTable.ColumnProperty(name="箇所名", type="string"),
                        glue.CfnTable.ColumnProperty(name="行路id", type="string"),
                        glue.CfnTable.ColumnProperty(name="行路名称", type="string"),
                        glue.CfnTable.ColumnProperty(name="測定年月日", type="string"),
                        glue.CfnTable.ColumnProperty(name="線名コード", type="string"),
                        glue.CfnTable.ColumnProperty(name="線名名称", type="string"),
                        glue.CfnTable.ColumnProperty(name="通称線名コード", type="string"),
                        glue.CfnTable.ColumnProperty(name="通称線名名称", type="string"),
                        glue.CfnTable.ColumnProperty(name="線別コード", type="string"),
                        glue.CfnTable.ColumnProperty(name="線別名称", type="string"),
                        glue.CfnTable.ColumnProperty(name="駅_駅々間コード", type="string"),
                        glue.CfnTable.ColumnProperty(name="駅_駅々間名称", type="string"),
                        glue.CfnTable.ColumnProperty(name="電柱番号", type="string"),
                        glue.CfnTable.ColumnProperty(name="電柱通番", type="string"),
                        glue.CfnTable.ColumnProperty(name="架線構造", type="string"),
                        glue.CfnTable.ColumnProperty(name="架線構造名", type="string"),
                        glue.CfnTable.ColumnProperty(name="トロリ線種", type="string"),
                        glue.CfnTable.ColumnProperty(name="制御状況", type="string"),
                        glue.CfnTable.ColumnProperty(name="制御状況名", type="string"),
                        glue.CfnTable.ColumnProperty(name="電柱検知", type="string"),
                        glue.CfnTable.ColumnProperty(name="電柱検知名", type="string"),
                        glue.CfnTable.ColumnProperty(name="電柱間隔_標準", type="double"),
                        glue.CfnTable.ColumnProperty(name="電柱間隔_実測", type="double"),
                        glue.CfnTable.ColumnProperty(name="ch", type="double"),
                        glue.CfnTable.ColumnProperty(name="親ドラム番号", type="string"),
                        glue.CfnTable.ColumnProperty(name="子ドラム番号", type="string"),
                        glue.CfnTable.ColumnProperty(name="ドラム識別番号", type="string"),
                        glue.CfnTable.ColumnProperty(name="摩耗_最小値_1", type="double"),
                        glue.CfnTable.ColumnProperty(name="摩耗_最小値_2", type="double"),
                        glue.CfnTable.ColumnProperty(name="摩耗_最小値_3", type="double"),
                        glue.CfnTable.ColumnProperty(name="摩耗_最小値_4", type="double"),
                        glue.CfnTable.ColumnProperty(name="摩耗_最小値_5", type="double"),
                        glue.CfnTable.ColumnProperty(name="摩耗_最小値_6", type="double"),
                        glue.CfnTable.ColumnProperty(name="摩耗_最小値_7", type="double"),
                        glue.CfnTable.ColumnProperty(name="摩耗_最小値_8", type="double"),
                        glue.CfnTable.ColumnProperty(name="摩耗_最小値_9", type="double"),
                        glue.CfnTable.ColumnProperty(name="摩耗_最小値_10", type="double"),
                        glue.CfnTable.ColumnProperty(name="摩耗_最小値_11", type="double"),
                        glue.CfnTable.ColumnProperty(name="摩耗_最小値_12", type="double"),
                        glue.CfnTable.ColumnProperty(name="摩耗_最小値_13", type="double"),
                        glue.CfnTable.ColumnProperty(name="摩耗_最小値_14", type="double"),
                        glue.CfnTable.ColumnProperty(name="摩耗_管理度数_p0", type="double"),
                        glue.CfnTable.ColumnProperty(name="摩耗_管理度数_p1", type="double"),
                        glue.CfnTable.ColumnProperty(name="摩耗_管理度数_p2", type="double"),
                        glue.CfnTable.ColumnProperty(name="摩耗_平均値", type="double"),
                        glue.CfnTable.ColumnProperty(name="摩耗_標準偏差", type="double"),
                        glue.CfnTable.ColumnProperty(name="摩耗_管理値_p0", type="double"),
                        glue.CfnTable.ColumnProperty(name="摩耗_管理値_p1", type="double"),
                        glue.CfnTable.ColumnProperty(name="摩耗_管理値_p2", type="double"),
                        glue.CfnTable.ColumnProperty(name="動的偏位_最大偏位_左", type="double"),
                        glue.CfnTable.ColumnProperty(name="動的偏位_最大偏位_右", type="double"),
                        glue.CfnTable.ColumnProperty(name="動的偏位_起点側支持点", type="double"),
                        glue.CfnTable.ColumnProperty(name="動的偏位_終点側支持点", type="double"),
                        glue.CfnTable.ColumnProperty(name="動的偏位_径間中心", type="double"),
                        glue.CfnTable.ColumnProperty(name="静的偏位_最大偏位_左", type="double"),
                        glue.CfnTable.ColumnProperty(name="静的偏位_最大偏位_右", type="double"),
                        glue.CfnTable.ColumnProperty(name="静的偏位_起点側支持点", type="double"),
                        glue.CfnTable.ColumnProperty(name="静的偏位_終点側支持点", type="double"),
                        glue.CfnTable.ColumnProperty(name="静的偏位_径間中心", type="double"),
                        glue.CfnTable.ColumnProperty(name="高さ_最大値_径間内", type="double"),
                        glue.CfnTable.ColumnProperty(name="高さ_最小値_径間内", type="double"),
                        glue.CfnTable.ColumnProperty(name="高さ_起点側支持点", type="double"),
                        glue.CfnTable.ColumnProperty(name="高さ_終点側支持点", type="double"),
                        glue.CfnTable.ColumnProperty(name="高さ_径間中心", type="double"),
                        glue.CfnTable.ColumnProperty(name="支障物_左", type="string"),
                        glue.CfnTable.ColumnProperty(name="支障物_右", type="string"),
                        glue.CfnTable.ColumnProperty(name="離隔", type="double"),
                        glue.CfnTable.ColumnProperty(name="平行長", type="double"),
                        glue.CfnTable.ColumnProperty(name="勾配", type="double"),
                        glue.CfnTable.ColumnProperty(name="硬点_最大_上", type="double"),
                        glue.CfnTable.ColumnProperty(name="硬点_最大_下", type="double"),
                        glue.CfnTable.ColumnProperty(name="パンタ衝撃_最大_前", type="double"),
                        glue.CfnTable.ColumnProperty(name="パンタ衝撃_最大_後", type="double"),
                        glue.CfnTable.ColumnProperty(name="降雨フラグ", type="string"),
                        glue.CfnTable.ColumnProperty(name="降雨フラグ名", type="string"),
                        glue.CfnTable.ColumnProperty(name="タイムコード_先頭", type="string"),
                        glue.CfnTable.ColumnProperty(name="歴重ね無効フラグ", type="string")
                    ]
                )
            )
        )
        glue_table.add_dependency(glue_db)

        # 8. IAM User for Tableau Server
        tableau_user = iam.User(
            self,
            "TableauAthenaUser",
            user_name="TableauAthenaUser"
        )

        # S3 Permissions
        # Removed DataUploadBucket, only granting AthenaDataBucket permissions
        tableau_user.add_to_policy(iam.PolicyStatement(
            actions=["s3:GetBucketLocation", "s3:GetObject", "s3:ListBucket", "s3:ListMultipartUploadParts", "s3:ListBucketMultipartUploads"],
            resources=[athena_data_bucket.bucket_arn, f"{athena_data_bucket.bucket_arn}/*"]
        ))
        tableau_user.add_to_policy(iam.PolicyStatement(
            actions=["s3:GetBucketLocation", "s3:GetObject", "s3:ListBucket", "s3:ListMultipartUploadParts", "s3:ListBucketMultipartUploads", "s3:PutObject", "s3:AbortMultipartUpload"],
            resources=[athena_results_bucket.bucket_arn, f"{athena_results_bucket.bucket_arn}/*"]
        ))

        # Athena & Glue Permissions
        tableau_user.add_to_policy(iam.PolicyStatement(
            actions=[
                "athena:StartQueryExecution",
                "athena:GetQueryExecution",
                "athena:GetQueryResults",
                "athena:GetWorkGroup",
                "athena:StopQueryExecution",
                "glue:GetDatabase",
                "glue:GetDatabases",
                "glue:GetTable",
                "glue:GetTables",
                "glue:GetPartition",
                "glue:GetPartitions"
            ],
            resources=["*"] # In production, restrict to specific catalog/database/table/workgroup
        ))

        # Create Access Key
        access_key = iam.CfnAccessKey(
            self,
            "TableauUserAccessKey",
            user_name=tableau_user.user_name
        )

        CfnOutput(self, "TableauAccessKeyId", value=access_key.ref)
        CfnOutput(self, "TableauSecretAccessKey", value=access_key.attr_secret_access_key)
        CfnOutput(self, "AthenaQueryResultsBucket", value=athena_results_bucket.bucket_name)

        # Output the Function URL
        CfnOutput(self, "UploadApiUrl", value=fn_url.url)
