import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class FrontendStack extends cdk.Stack {
  public readonly hostingBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create S3 Bucket for static website hosting
    this.hostingBucket = new s3.Bucket(this, 'FrontendHostingBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: '404.html',
      publicReadAccess: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),
    });

    new cdk.CfnOutput(this, 'FrontendUrl', {
      value: this.hostingBucket.bucketWebsiteUrl,
      description: 'The URL of the hosted frontend website',
    });
  }
}
