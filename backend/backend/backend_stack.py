from aws_cdk import Stack, aws_s3 as s3, aws_lambda as lambda_, RemovalPolicy, CfnOutput
from constructs import Construct
import os


class BackendStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # 1. Create S3 Bucket with CORS
        bucket = s3.Bucket(
            self,
            "DataUploadBucket",
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
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

        # 2. Create Lambda handling presigned URLs
        handler = lambda_.Function(
            self,
            "PresignedUrlHandler",
            runtime=lambda_.Runtime.PYTHON_3_13,
            code=lambda_.Code.from_asset("lambda"),
            handler="handler.handler",
            environment={"BUCKET_NAME": bucket.bucket_name},
        )

        # 3. Grant bucket permissions to Lambda
        bucket.grant_put(handler)
        bucket.grant_read(
            handler
        )  # Needed for complete_multipart_upload to verify parts

        # 4. Create Lambda Function URL
        fn_url = handler.add_function_url(
            auth_type=lambda_.FunctionUrlAuthType.NONE,
            cors=lambda_.FunctionUrlCorsOptions(
                allowed_origins=["*"],
                allowed_methods=[lambda_.HttpMethod.ALL],
                allowed_headers=["*"],
            ),
        )

        # Output the Function URL
        CfnOutput(self, "UploadApiUrl", value=fn_url.url)
