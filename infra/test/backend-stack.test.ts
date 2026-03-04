import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as Backend from '../lib/backend-stack';

test('Backend Stack Created', () => {
  const app = new cdk.App();
  // WHEN
  const stack = new Backend.BackendStack(app, 'MyTestBackendStack');
  // THEN
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::S3::Bucket', {});
  template.hasResourceProperties('AWS::Lambda::Function', {
    Handler: 'dashboard_api_handler.handler'
  });
});
