import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as Frontend from '../lib/frontend-stack';

test('Frontend Stack Created', () => {
  const app = new cdk.App();
  // WHEN
  const stack = new Frontend.FrontendStack(app, 'MyTestFrontendStack');
  // THEN
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::S3::Bucket', {
    WebsiteConfiguration: {
      IndexDocument: 'index.html',
      ErrorDocument: '404.html'
    }
  });
});
