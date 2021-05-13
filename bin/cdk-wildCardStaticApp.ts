#!/usr/bin/env node

import { Construct }  from 'constructs';
import * as cdk from 'aws-cdk-lib';
import { wildCardStaticApp } from '../lib/wildCardStaticApp-stack';

const app = new cdk.App();
const envUS  = { 
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1' // Note the region is hard coded to us-east-1 as this is the requiref region for CloudFront certificates
};

new wildCardStaticApp(app, 'wildCardStaticApp', { env: envUS} );
