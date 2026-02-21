import re

with open("backend/backend_stack.py", "r") as f:
    content = f.read()

with open("columns.py", "r") as f:
    columns_code = f.read()

imports = """
from aws_cdk import Stack, aws_s3 as s3, aws_lambda as lambda_, RemovalPolicy, CfnOutput, aws_glue as glue, aws_iam as iam
"""
content = re.sub(r"from aws_cdk import.*", imports.strip(), content)

athena_code = f"""
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

        # 7. Glue Table with Partition Projection
        table_name = "twins_digital_data"
        glue_table = glue.CfnTable(
            self,
            "TableauAccessTable",
            catalog_id=self.account,
            database_name=database_name,
            table_input=glue.CfnTable.TableInputProperty(
                name=table_name,
                table_type="EXTERNAL_TABLE",
                parameters={{
                    "skip.header.line.count": "3",
                    "classification": "csv",
                    "projection.enabled": "true",
                    "projection.branch.type": "injected",
                    "projection.mc.type": "injected",
                    "storage.location.template": f"s3://{{bucket.bucket_name}}/tableau-access/${{branch}}/${{mc}}/"
                }},
                partition_keys=[
                    glue.CfnTable.ColumnProperty(name="branch", type="string"),
                    glue.CfnTable.ColumnProperty(name="mc", type="string"),
                ],
                storage_descriptor=glue.CfnTable.StorageDescriptorProperty(
                    location=f"s3://{{bucket.bucket_name}}/tableau-access/",
                    input_format="org.apache.hadoop.mapred.TextInputFormat",
                    output_format="org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat",
                    serde_info=glue.CfnTable.SerdeInfoProperty(
                        serialization_library="org.apache.hadoop.hive.serde2.OpenCSVSerde",
                        parameters={{
                            "separatorChar": ",",
                            "quoteChar": "\\"",
                            "escapeChar": "\\\\"
                        }}
                    ),
                    columns=[
{columns_code}
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
        tableau_user.add_to_policy(iam.PolicyStatement(
            actions=["s3:GetBucketLocation", "s3:GetObject", "s3:ListBucket", "s3:ListMultipartUploadParts", "s3:ListBucketMultipartUploads"],
            resources=[bucket.bucket_arn, f"{{bucket.bucket_arn}}/*"]
        ))
        tableau_user.add_to_policy(iam.PolicyStatement(
            actions=["s3:GetBucketLocation", "s3:GetObject", "s3:ListBucket", "s3:ListMultipartUploadParts", "s3:ListBucketMultipartUploads", "s3:PutObject", "s3:AbortMultipartUpload"],
            resources=[athena_results_bucket.bucket_arn, f"{{athena_results_bucket.bucket_arn}}/*"]
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

"""

# Insert before CfnOutput(self, "UploadApiUrl", value=fn_url.url)
content = content.replace('        # Output the Function URL\n        CfnOutput(self, "UploadApiUrl", value=fn_url.url)', athena_code + '\n        # Output the Function URL\n        CfnOutput(self, "UploadApiUrl", value=fn_url.url)')

with open("backend/backend_stack.py", "w") as f:
    f.write(content)
