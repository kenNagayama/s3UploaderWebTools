import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as Frontend from '../lib/frontend-stack';

import * as apigw from 'aws-cdk-lib/aws-apigateway';

test('Frontend Stack Created', () => {
  const app = new cdk.App();
  
  // Create a dummy stack to hold the mocked API
  const dummyStack = new cdk.Stack(app, 'DummyStack');
  const dummyApi = new apigw.RestApi(dummyStack, 'DummyApi');

  // WHEN
  const stack = new Frontend.FrontendStack(app, 'MyTestFrontendStack', {
    dashboardApi: dummyApi,
    uploadApiUrl: 'https://dummy.lambda-url.ap-northeast-1.on.aws/',
    customHeaderSecret: 'dummy-secret'
  });
  // THEN
  const template = Template.fromStack(stack);

  // The previous test checked for S3 WebsiteConfiguration, but we changed 
  // the bucket to be private and serve via CloudFront, so let's check for OAI instead.
  template.hasResourceProperties('AWS::S3::Bucket', {
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true
    }
  });
});
