import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfront_origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

export interface FrontendStackProps extends cdk.StackProps {
  dashboardApi: apigw.RestApi;
  uploadApiUrl: string;
  customHeaderSecret: string;
}

export class FrontendStack extends cdk.Stack {
  public readonly hostingBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    // Create S3 Bucket for static website hosting (private access only)
    this.hostingBucket = new s3.Bucket(this, 'FrontendHostingBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // Create Origin Access Identity (OAI) for CloudFront to access the bucket
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI');
    this.hostingBucket.grantRead(originAccessIdentity);

    // Create CloudFront Distribution
    const distribution = new cloudfront.Distribution(this, 'FrontendDistribution', {
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 404,
          responsePagePath: '/404.html',
          ttl: cdk.Duration.minutes(30),
        },
      ],
      defaultBehavior: {
        origin: new cloudfront_origins.S3Origin(this.hostingBucket, { originAccessIdentity }),
        compress: true,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        '/api/dashboard/*': {
          // Route to API Gateway (Dashboard API).
          origin: new cloudfront_origins.RestApiOrigin(props.dashboardApi, {
            customHeaders: {
              'X-Origin-Verify': props.customHeaderSecret
            }
          }),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
        '/api/upload/*': {
          // Route to Lambda Function URL.
          origin: new cloudfront_origins.HttpOrigin(cdk.Fn.parseDomainName(props.uploadApiUrl), {
            customHeaders: {
              'X-Origin-Verify': props.customHeaderSecret
            }
          }),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        }
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // Cheapest option
    });

    new cdk.CfnOutput(this, 'FrontendUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'The CloudFront URL of the hosted frontend website',
    });
  }
}
