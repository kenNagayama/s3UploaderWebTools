import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as glue from 'aws-cdk-lib/aws-glue';
import { Construct } from 'constructs';
import * as path from 'path';

interface BackendStackProps extends cdk.StackProps {
  frontendBucketUrl?: string; // Optional prop to configure CORS specifically for frontend if needed
}

export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: BackendStackProps) {
    super(scope, id, props);

    // ==========================================
    // CI/CD: GitHub Actions OIDC Provider & Role
    // ==========================================
    const githubDomain = 'token.actions.githubusercontent.com';
    
    const oidcProvider = new iam.OpenIdConnectProvider(this, 'GitHubOIDCProvider', {
      url: `https://${githubDomain}`,
      clientIds: ['sts.amazonaws.com'],
    });

    const githubRole = new iam.Role(this, 'GitHubActionsDeployRole', {
      roleName: 'GitHubActionsDeployRole-S3Uploader-TS',
      assumedBy: new iam.OpenIdConnectPrincipal(oidcProvider, {
        StringLike: {
          [`${githubDomain}:sub`]: 'repo:kenNagayama/s3UploaderWebTools:*'
        },
        StringEquals: {
          [`${githubDomain}:aud`]: 'sts.amazonaws.com'
        }
      })
    });
    githubRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'));
    
    new cdk.CfnOutput(this, 'GitHubActionsRoleArn', { value: githubRole.roleArn });

    // ==========================================
    // 1. Create S3 Bucket (Raw Data / Upload Bucket) with CORS
    // ==========================================
    const uploadBucket = new s3.Bucket(this, 'DataUploadBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: true,
      lifecycleRules: [
        {
          noncurrentVersionExpiration: cdk.Duration.days(30),
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        }
      ],
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.GET,
            s3.HttpMethods.HEAD,
            s3.HttpMethods.DELETE,
          ],
          allowedOrigins: ['*'], // In production, restrict to frontend URL
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag'],
          maxAge: 3000,
        }
      ]
    });

    // 2. Create S3 Bucket (Clean Data / Athena Bucket)
    const athenaDataBucket = new s3.Bucket(this, 'AthenaDataBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: true,
      lifecycleRules: [
        {
          noncurrentVersionExpiration: cdk.Duration.days(30),
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        }
      ],
    });

    // ==========================================
    // Athena & Glue Resources for Tableau Access
    // ==========================================
    
    // 5. Athena Query Results Bucket
    const athenaResultsBucket = new s3.Bucket(this, 'AthenaResultsBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET],
          allowedOrigins: ['*'], // Allow frontend to download presigned URL
          allowedHeaders: ['*'],
          maxAge: 3000,
        }
      ]
    });

    // 6. Glue Database
    const databaseName = 'tableau_access_db';
    const glueDb = new glue.CfnDatabase(this, 'TableauAccessDatabase', {
      catalogId: this.account,
      databaseInput: {
        name: databaseName,
        description: 'Database for Tableau to query S3 CSVs via Athena'
      }
    });

    // 7. Glue Table (No Partitions for Full Extract capability)
    const tableName = 'twins_digital_data';
    const glueTable = new glue.CfnTable(this, 'TableauAccessTable', {
      catalogId: this.account,
      databaseName: databaseName,
      tableInput: {
        name: tableName,
        tableType: 'EXTERNAL_TABLE',
        parameters: {
          'skip.header.line.count': '0',
          'classification': 'csv',
          'use.null.for.invalid.data': 'true'
        },
        storageDescriptor: {
          location: `s3://${athenaDataBucket.bucketName}/tableau-access/`,
          inputFormat: 'org.apache.hadoop.mapred.TextInputFormat',
          outputFormat: 'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat',
          serdeInfo: {
            serializationLibrary: 'org.apache.hadoop.hive.serde2.OpenCSVSerde',
            parameters: {
              separatorChar: ',',
              quoteChar: '"',
              escapeChar: '\\\\'
            }
          },
          columns: [
            // Extracted essential columns from Python definition
            { name: "no", type: "int" },
            { name: "測定年", type: "int" },
            { name: "年内通番", type: "int" },
            { name: "支社コード", type: "string" },
            { name: "技セコード", type: "string" },
            { name: "メセコード", type: "string" },
            { name: "箇所名", type: "string" },
            { name: "行路id", type: "string" },
            { name: "行路名称", type: "string" },
            { name: "測定年月日", type: "string" },
            { name: "線名コード", type: "string" },
            { name: "線名名称", type: "string" },
            { name: "通称線名コード", type: "string" },
            { name: "通称線名名称", type: "string" },
            { name: "線別コード", type: "string" },
            { name: "線別名称", type: "string" },
            { name: "駅_駅々間コード", type: "string" },
            { name: "駅_駅々間名称", type: "string" },
            { name: "電柱番号", type: "string" },
            { name: "電柱通番", type: "string" },
            { name: "架線構造", type: "string" },
            { name: "架線構造名", type: "string" },
            { name: "トロリ線種", type: "string" },
            { name: "制御状況", type: "string" },
            { name: "制御状況名", type: "string" },
            { name: "電柱検知", type: "string" },
            { name: "電柱検知名", type: "string" },
            { name: "電柱間隔_標準", type: "double" },
            { name: "電柱間隔_実測", type: "double" },
            { name: "ch", type: "double" },
            { name: "親ドラム番号", type: "string" },
            { name: "子ドラム番号", type: "string" },
            { name: "ドラム識別番号", type: "string" },
            { name: "摩耗_管理度数_p0", type: "double" },
            { name: "摩耗_管理度数_p1", type: "double" },
            { name: "摩耗_管理度数_p2", type: "double" },
            { name: "摩耗_平均値", type: "double" },
            { name: "摩耗_標準偏差", type: "double" },
            { name: "摩耗_管理値_p0", type: "double" },
            { name: "摩耗_管理値_p1", type: "double" },
            { name: "摩耗_管理値_p2", type: "double" },
            { name: "動的偏位_最大偏位_左", type: "double" },
            { name: "動的偏位_最大偏位_右", type: "double" },
            { name: "動的偏位_起点側支持点", type: "double" },
            { name: "動的偏位_終点側支持点", type: "double" },
            { name: "動的偏位_径間中心", type: "double" },
            { name: "静的偏位_最大偏位_左", type: "double" },
            { name: "静的偏位_最大偏位_右", type: "double" },
            { name: "静的偏位_起点側支持点", type: "double" },
            { name: "静的偏位_終点側支持点", type: "double" },
            { name: "静的偏位_径間中心", type: "double" },
            { name: "高さ_最大値_径間内", type: "double" },
            { name: "高さ_最小値_径間内", type: "double" },
            { name: "高さ_起点側支持点", type: "double" },
            { name: "高さ_終点側支持点", type: "double" },
            { name: "高さ_径間中心", type: "double" },
            { name: "支障物_左", type: "string" },
            { name: "支障物_右", type: "string" },
            { name: "離隔", type: "double" },
            { name: "平行長", type: "double" },
            { name: "勾配", type: "double" },
            { name: "硬点_最大_上", type: "double" },
            { name: "硬点_最大_下", type: "double" },
            { name: "パンタ衝撃_最大_前", type: "double" },
            { name: "パンタ衝撃_最大_後", type: "double" },
            { name: "降雨フラグ", type: "string" },
            { name: "降雨フラグ名", type: "string" },
            { name: "タイムコード_先頭", type: "string" },
            { name: "歴重ね無効フラグ", type: "string" },
            { name: "ハンガ位置", type: "int" },
            { name: "摩耗_最小値", type: "double" },
            { name: "新品時直径", type: "double" }
          ]
        }
      }
    });
    glueTable.addDependency(glueDb);

    // ==========================================
    // Lambda Functions
    // ==========================================
    const lambdaCodePath = path.resolve(__dirname, '../../backend/lambda');

    // 3. Create Lambda handling presigned URLs (Existing Uploader logic)
    const presignedUrlHandler = new lambda.Function(this, 'PresignedUrlHandler', {
      runtime: lambda.Runtime.PYTHON_3_13,
      code: lambda.Code.fromAsset(lambdaCodePath),
      handler: 'handler.handler',
      environment: { BUCKET_NAME: uploadBucket.bucketName },
    });
    uploadBucket.grantPut(presignedUrlHandler);
    uploadBucket.grantRead(presignedUrlHandler);
    uploadBucket.grantDelete(presignedUrlHandler);

    const fnUrl = presignedUrlHandler.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ['*'],
        allowedMethods: [lambda.HttpMethod.ALL],
        allowedHeaders: ['*'],
      }
    });

    // 4. Create Transform Lambda
    const transformHandler = new lambda.Function(this, 'CsvTransformHandler', {
      runtime: lambda.Runtime.PYTHON_3_13,
      code: lambda.Code.fromAsset(lambdaCodePath),
      handler: 'transform_handler.handler',
      environment: {
        SOURCE_BUCKET: uploadBucket.bucketName,
        DEST_BUCKET: athenaDataBucket.bucketName
      },
      memorySize: 1024,
      timeout: cdk.Duration.minutes(5)
    });
    uploadBucket.grantRead(transformHandler);
    athenaDataBucket.grantPut(transformHandler);

    uploadBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(transformHandler),
      { prefix: 'tableau-access/', suffix: '.csv' }
    );

    // 9. Dashboard API Lambda
    const dashboardApiHandler = new lambda.Function(this, 'DashboardApiHandler', {
      runtime: lambda.Runtime.PYTHON_3_13,
      code: lambda.Code.fromAsset(lambdaCodePath),
      handler: 'dashboard_api_handler.handler',
      environment: {
        ATHENA_RESULTS_BUCKET: athenaResultsBucket.bucketName,
        DATABASE_NAME: databaseName,
        TABLE_NAME: tableName
      },
      memorySize: 512,
      timeout: cdk.Duration.minutes(1)
    });

    athenaDataBucket.grantRead(dashboardApiHandler);
    athenaResultsBucket.grantReadWrite(dashboardApiHandler);
    
    dashboardApiHandler.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        "athena:StartQueryExecution",
        "athena:GetQueryExecution",
        "athena:GetQueryResults",
        "glue:GetDatabase",
        "glue:GetTable",
        "glue:GetDatabases",
        "glue:GetTables",
        "glue:GetPartition",
        "glue:GetPartitions"
      ],
      resources: ["*"]
    }));

    // 10. API Gateway for Dashboard
    const api = new apigw.RestApi(this, 'DashboardApi', {
      restApiName: 'Dashboard API Service',
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS,
        allowHeaders: apigw.Cors.DEFAULT_HEADERS
      }
    });

    const dashboardIntegration = new apigw.LambdaIntegration(dashboardApiHandler);
    const dashboardResource = api.root.addResource('dashboard');
    dashboardResource.addMethod('GET', dashboardIntegration);

    // ==========================================
    // 8. IAM User for Tableau Server
    // ==========================================
    const tableauUser = new iam.User(this, 'TableauAthenaUser', {
      userName: 'TableauAthenaUser'
    });

    tableauUser.addToPolicy(new iam.PolicyStatement({
      actions: ["s3:GetBucketLocation", "s3:GetObject", "s3:ListBucket", "s3:ListMultipartUploadParts", "s3:ListBucketMultipartUploads"],
      resources: [athenaDataBucket.bucketArn, `${athenaDataBucket.bucketArn}/*`]
    }));
    tableauUser.addToPolicy(new iam.PolicyStatement({
      actions: ["s3:GetBucketLocation", "s3:GetObject", "s3:ListBucket", "s3:ListMultipartUploadParts", "s3:ListBucketMultipartUploads", "s3:PutObject", "s3:AbortMultipartUpload"],
      resources: [athenaResultsBucket.bucketArn, `${athenaResultsBucket.bucketArn}/*`]
    }));
    tableauUser.addToPolicy(new iam.PolicyStatement({
      actions: [
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
      resources: ["*"]
    }));

    const accessKey = new iam.CfnAccessKey(this, 'TableauUserAccessKey', {
      userName: tableauUser.userName
    });

    // Outputs
    new cdk.CfnOutput(this, 'TableauAccessKeyId', { value: accessKey.ref });
    new cdk.CfnOutput(this, 'TableauSecretAccessKey', { value: accessKey.attrSecretAccessKey });
    new cdk.CfnOutput(this, 'UploadApiUrl', { value: fnUrl.url });
    new cdk.CfnOutput(this, 'DashboardApiUrl', { value: api.url });
  }
}
