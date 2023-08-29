# AWS Route53 Hosted Zones Migration Script

## Overview

This TypeScript script is designed to automate the process of exporting DNS records from an AWS Route53 hosted zone in one AWS account and preparing it for importing into another AWS Route53 hosted zone, possibly in a different AWS account. It filters out NS and SOA records and saves the remaining records in a JSON file. The script is written based on the AWS Route53 developer guide for migrating hosted zones, as of the date 2023-08-29. More information can be found [here](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/hosted-zones-migrating.html).

## Disclaimer

:warning: **Use this script at your own risk.** Just have to mention as DNS migration is sensitive matter and can be dangerous if not followed correctly, so this script is provided "as is" and is intended for use at your own risk. While I've made an effort to ensure its accuracy, I can't guarantee it's error-free. Please use this script cautiously, ideally with test data first, and back up your data before taking any actions. And if you find any issues, please let me know by opening an issue or submitting a pull request. If you are happy with the above please feel free to continue with the steps below.

## Prerequisites

- Node.js (version 18.x or above) and npm
- AWS CLI (version 2.x)

## Setup

### AWS CLI Configuration

Before running the script, ensure that you have configured the AWS CLI profiles for both the source and target AWS accounts.

1. **Configure the Source AWS Account**

   Run `aws configure --profile old-aws-account-profile` and follow the prompts to input your AWS Access Key ID, Secret Access Key, default region, and output format.

2. **Configure the Target AWS Account**

   Run `aws configure --profile new-aws-account-profile` and follow the prompts.

### Installing Dependencies

1. Install Node.js dependencies by running \`npm install\` in the directory where the script is located.

## Running the Script

1. Run the script by executing `npm start`.

2. You will be prompted to select the AWS profile for the source AWS account. Choose the profile you set up for the source account (e.g., `old-aws-account-profile`).

3. Next, you will be prompted to choose a hosted zone from the source AWS account. The script will list all available hosted zones.

4. The script will then process the records, filter out NS and SOA records, and save them to a JSON file named `{HostedZoneID}-migrated.json`.

5. You will then be prompted to select the AWS profile for the target AWS account. Choose the profile you set up for the target account (e.g., `new-aws-account-profile`).

6. Finally, you'll be prompted to select a hosted zone in the target AWS account where you'd like to import the DNS records.

## Important Post-Migration Steps

After running the script, there are few additional steps (Steps 8, 9 and 10) you might need to follow as outlined in the [AWS Route53 Developer Guide for migrating hosted zones](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/hosted-zones-migrating.html):

> :warning: **Failure to follow these steps can result in the domain becoming unavailable.**

## Troubleshooting

If you encounter issues related to empty `ResourceRecords` in your JSON, ensure your AWS SDK is up-to-date. The script automatically omits empty `ResourceRecords` fields.
