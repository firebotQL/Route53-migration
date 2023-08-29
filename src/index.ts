import {
  ChangeBatch,
  HostedZone,
  ResourceRecordSet,
  Route53,
} from "@aws-sdk/client-route-53";
import { fromIni } from "@aws-sdk/credential-providers";

import Enquirer from "enquirer";
import * as fs from "fs";
import * as ini from "ini";
import * as os from "os";
import * as path from "path";

const listAWSProfiles = (): string[] => {
  const credsFilePath = path.join(os.homedir(), ".aws", "credentials");
  const credentials = ini.parse(fs.readFileSync(credsFilePath, "utf-8"));
  return Object.keys(credentials);
};

const initializeAWS = async (promptMessage: string) => {
  const profiles = listAWSProfiles();
  const response: { selectedProfile: string } = await Enquirer.prompt({
    type: "select",
    name: "selectedProfile",
    message: promptMessage,
    choices: profiles,
  });

  const credentials = fromIni({
    profile: response.selectedProfile, // Optional
  });

  return new Route53({
    credentials: credentials,
  });
};

const listHostedZones = async (route53: Route53) => {
  return new Promise<HostedZone[] | undefined>((resolve, reject) => {
    route53.listHostedZones({}, (err, data) => {
      if (err) reject(err);
      else resolve(data?.HostedZones);
    });
  });
};

const getResourceRecords = async (route53: Route53, hostedZoneId: string) => {
  return new Promise<ResourceRecordSet[] | undefined>((resolve, reject) => {
    route53.listResourceRecordSets(
      { HostedZoneId: hostedZoneId },
      (err, data) => {
        if (err) reject(err);
        else resolve(data?.ResourceRecordSets);
      }
    );
  });
};

// Function to compare old and new records
const compareRecords = (
  oldRecords: ResourceRecordSet[],
  newRecords: ResourceRecordSet[]
) => {
  const oldFiltered = oldRecords.filter(
    (record) => !["NS", "SOA"].includes(record?.Type ?? "")
  );
  const newFiltered = newRecords.filter(
    (record) => !["NS", "SOA"].includes(record?.Type ?? "")
  );

  const missingRecords: ResourceRecordSet[] = [];

  oldFiltered.forEach((oldRecord) => {
    const match = newFiltered.find((newRecord) => {
      return (
        newRecord.Type === oldRecord.Type && newRecord.Name === oldRecord.Name
      );
    });

    if (!match) {
      missingRecords.push(oldRecord);
    }
  });

  if (missingRecords.length === 0) {
    console.log("All records successfully migrated.");
  } else {
    console.log("Missing records:");
    console.log(JSON.stringify(missingRecords, null, 4));
  }
};

const processRecords = async () => {
  // Source Account
  const route53Source = await initializeAWS("Select source AWS profile:");
  const hostedZonesSource = await listHostedZones(route53Source);

  if (!hostedZonesSource || hostedZonesSource.length === 0) {
    console.error(
      "No hosted zones found in the source. Please check your AWS credentials or your AWS HosteZone if it's configured correctly."
    );
    return;
  }

  const responseSource: { selectedZone: string } = await Enquirer.prompt({
    type: "select",
    name: "selectedZone",
    message: "Select a source Hosted Zone:",
    choices: hostedZonesSource.map((zone) => zone.Name ?? ""),
  });

  const selectedSourceZone = hostedZonesSource.find(
    (zone) => zone.Name === responseSource.selectedZone
  );

  if (!selectedSourceZone) {
    console.error("No source hosted zone selected.");
    return;
  }

  const selectedSourceZoneId = selectedSourceZone!.Id ?? "";

  const resourceRecords =
    (await getResourceRecords(route53Source, selectedSourceZone!.Id ?? "")) ??
    [];

  // Destination Account
  const route53Dest = await initializeAWS("Select destination AWS profile:");
  const hostedZonesDest = await listHostedZones(route53Dest);

  if (!hostedZonesDest || hostedZonesDest.length === 0) {
    console.error(
      "No hosted zones found in the destionation. Please check your AWS credentials or your AWS HosteZone if it's configured correctly."
    );
    return;
  }

  const responseDest: { selectedZone: string } = await Enquirer.prompt({
    type: "select",
    name: "selectedZone",
    message: "Select a destination Hosted Zone:",
    choices: hostedZonesDest.map((zone) => zone.Name ?? ""),
  });

  const selectedDestZone = hostedZonesDest.find(
    (zone) => zone.Name === responseDest.selectedZone
  );

  if (!selectedDestZone) {
    console.error("No destination hosted zone selected.");
    return;
  }

  const selectedDestZoneId = selectedDestZone!.Id ?? "";

  const newJson: ChangeBatch = {
    Comment: "Transformed by script",
    Changes: resourceRecords
      .filter((record) => !["NS", "SOA"].includes(record?.Type ?? ""))
      .map((record) => {
        const newRecord: ResourceRecordSet = {
          ...record,
        };
        // Omit ResourceRecords if empty
        if (
          newRecord.ResourceRecords &&
          newRecord.ResourceRecords.length === 0
        ) {
          delete newRecord.ResourceRecords;
        }
        return {
          Action: "CREATE",
          ResourceRecordSet: newRecord,
        };
      }),
  };

  const newJsonString = JSON.stringify(newJson, null, 4);
  const outputFile = `${selectedDestZoneId.split("/").pop()}-migrated.json`;
  fs.writeFileSync(outputFile, newJsonString, "utf8");
  console.log(`Successfully written to file: ${outputFile}`);

  // Now, let's import this to the destination hosted zone.
  route53Dest.changeResourceRecordSets(
    { HostedZoneId: selectedDestZoneId, ChangeBatch: newJson },
    (err, data) => {
      if (err) {
        console.error("Failed to import records:", err);
      } else {
        console.log("Successfully imported records to the new hosted zone.");
      }
    }
  );

  // Old Records
  const oldRecords =
    (await getResourceRecords(route53Source, selectedSourceZoneId)) ?? [];

  // New Records
  const newRecords =
    (await getResourceRecords(route53Dest, selectedDestZoneId)) ?? [];

  // Compare Old and New Records
  compareRecords(oldRecords, newRecords);
};

processRecords().catch((error) => {
  console.error("An error occurred:", error);
});
