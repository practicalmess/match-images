import Jimp from "jimp";
import {
  S3Client,
  // This command supersedes the ListObjectsCommand and is the recommended way to list objects.
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import * as fs from "fs";
import { parse } from "csv-parse";
import { finished } from "stream/promises";
import { type } from "os";

export async function compareImages(fullImage, thumbnail, fullImageUri) {
  try {
    const scaledFullImage = fullImage.scale(0.08);

    // Perform pixel diff
    const diff = Jimp.diff(thumbnail.image, scaledFullImage);
    const hashDistance = Jimp.distance(thumbnail.image, scaledFullImage);
    return { hashDistance, diff };
  } catch (err) {
    console.log(err);
  }
}

async function findMatch(fullImage, thumbnails) {
  let potentialMatches = [];
  await Promise.all(
    thumbnails.map(async (thumbnailKey) => {
      const similarityScore = await compareImages(fullImage, thumbnailKey);
      if (similarityScore < 0.18) {
        console.log(
          `${fullImage.slice(
            -20
          )} potential match: ${thumbnailKey} (${similarityScore})`
        );
        potentialMatches.push(thumbnailKey);

        // scores.push({ key: thumbnail.slice(19, -4), similarityScore });
      }
    })
  );
  const outlierMatch = findOutlier(potentialMatches);
  if (outlierMatch) {
    console.log(outlierMatch);
    return outlierMatch;
  } else {
    return null;
  }
}

const client = new S3Client({
  endpoint: "https://nyc3.digitaloceanspaces.com",
  region: "us-east-1",
  credentials: {
    accessKeyId: "DO00GBJCHV37PR4XXWTA",
    secretAccessKey: "iLpbN4lrM8WDWRwwXxf1p2ymX0wEZyvMK5fr9aO4TUc",
  },
});

export const getFullImages = async () => {
  const command = new ListObjectsV2Command({
    Bucket: "the-last-poster-show",
    Delimiter: ",",
    // StartAfter: 1000,
    MaxKeys: 10,
  });

  try {
    let isTruncated = true;
    const imageList = [];

    while (isTruncated) {
      const { Contents, IsTruncated, NextContinuationToken } =
        await client.send(command);
      imageList.push(
        ...Contents.map((c, i) => {
          if (
            c.Key !== "image-storage/" &&
            c.Key !== "image-storage/full-size"
          ) {
            return `https://the-last-poster-show.nyc3.digitaloceanspaces.com/${c.Key}`;
          }
        })
      );
      isTruncated = IsTruncated;

      command.input.ContinuationToken = NextContinuationToken;
    }
    return imageList;
  } catch (err) {
    console.error(err);
  }
};

const parseRawInv = async () => {
  const records = [];
  const parser = fs.createReadStream(`csvs/full-raw-inv.csv`).pipe(
    parse({
      // CSV options if any
    })
  );
  parser.on("readable", function () {
    let record;
    while ((record = parser.read()) !== null) {
      // Work with each record
      records.push(record);
    }
  });
  await finished(parser);
  return records;
};

export async function getAllKeys() {
  const allInfo = await parseRawInv();
  const keys = [];
  const keyedInfo = [];
  allInfo.forEach((row) => {
    if (row[0].length > 8) {
      keys.push(row[0]); // only add key if it is longer than -style-1
      keyedInfo.push({
        key: row[0],
        price: row[1],
        title: row[2],
        genre: row[3],
        tags: row[4],
        category: row[5],
      });
    }
  });
  return { keys, keyedInfo };
}
