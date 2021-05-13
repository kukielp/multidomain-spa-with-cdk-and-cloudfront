import * as cdk from 'aws-cdk-lib';

import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_s3_deployment } from 'aws-cdk-lib';
import { aws_cloudfront } from 'aws-cdk-lib';
import { aws_certificatemanager as acm } from 'aws-cdk-lib';
import { aws_route53 as route53 } from 'aws-cdk-lib';
import { aws_route53_targets as targets } from 'aws-cdk-lib';


import { Construct }  from 'constructs';



const websiteDistSourcePath = './app';

export class wildCardStaticApp extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /*
      This will pick up deploytime command line context parameters 
      eg:  cdk deploy -c primaryDomain=exampledomain.com 
    */
    const primaryDomain = "inspecthero.com"//this.node.tryGetContext('primaryDomain');

    /*
      Use the name of a Route53 hosted zone that exists in your account, replace 
      exampledomain with your Hostedzone
    */
    const subDomain = `*.${primaryDomain}`

    // Create a private S3 bucket
    const sourceBucket = new s3.Bucket(this, 'cdk-mypoc-website-s3', {
      websiteIndexDocument: 'index.html',
      bucketName: `wildcard-${primaryDomain}`
    });

    const originAccessIdentity = new aws_cloudfront.OriginAccessIdentity(this, 'OIA', {
      comment: "Setup access from CloudFront to the bucket ( read )"
    });
    sourceBucket.grantRead(originAccessIdentity);

    // Deploy the source code from the /app folder, in this example thats just 1 file.
    new aws_s3_deployment.BucketDeployment(this, 'DeployWebsite', {
      sources: [aws_s3_deployment.Source.asset(websiteDistSourcePath)],
      destinationBucket: sourceBucket
    });

    // We are using a Zone that already exists so we can use a lookup on the Zone name.
    const zone = route53.HostedZone.fromLookup(this, 'baseZone', {
      domainName: primaryDomain
    });

    // Request the wildcard TLS certificate, CDK will take care of domain ownership validation via 
    // CNAME DNS entries in Route53, a custom resource will be used on our behalf
    const myCertificate = new acm.DnsValidatedCertificate(this, 'mySiteCert', {
      domainName: subDomain,
      hostedZone: zone,
    });

    // Create the CloudFront Distribution, set the alternate CNAMEs and pass in the ACM ARN of the cert created.
    const cfDist = new aws_cloudfront.CloudFrontWebDistribution(this, 'myDist', {
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: sourceBucket,
            originAccessIdentity: originAccessIdentity
          },
          behaviors: [
            { isDefaultBehavior: true }
          ]
        }
      ],
      viewerCertificate: {
        
        aliases: [subDomain],
        props: {
            acmCertificateArn: myCertificate.certificateArn,
            sslSupportMethod: "sni-only",
          }
      }
    });
  
    // Create the wildcard DNS entry in route53 as an alias to the new CloudFront Distribution.
    new route53.ARecord(this, 'AliasRecord', {
      zone,
      recordName: subDomain,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(cfDist)),
    });
  }
}