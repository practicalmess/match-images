import Jimp from "jimp";
import {
  S3Client,
  // This command supersedes the ListObjectsCommand and is the recommended way to list objects.
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import * as fs from "fs";
import { parse } from "csv-parse";
import { finished } from "stream/promises";

function findOutlier(arr) {
  // Sort the array
  arr.sort((a, b) => a.similarityScore - b.similarityScore);

  // Calculate the first and third quartiles (Q1 and Q3)
  const q1 = quartile(
    arr.map((obj) => obj.similarityScore),
    0.25
  );
  const q3 = quartile(
    arr.map((obj) => obj.similarityScore),
    0.75
  );

  // Calculate the interquartile range (IQR)
  const iqr = q3 - q1;

  // Define lower and upper bounds for outliers
  const lowerBound = q1 - 3 * iqr;
  const upperBound = q3 + 3 * iqr;

  // Find outliers
  const outliers = arr.filter((obj) => obj.similarityScore < lowerBound);
  if (outliers.length > 0) {
    return outliers[0].key;
  } else {
    return null;
  }
}

// Function to calculate a specific quartile of an array
function quartile(arr, q) {
  const pos = (arr.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (arr[base + 1] !== undefined) {
    return arr[base] + rest * (arr[base + 1] - arr[base]);
  } else {
    return arr[base];
  }
}

export async function compareImages(fullImagePath, thumbnailImage) {
  if (typeof fullImagePath === "string" && fullImagePath.slice(-4) === ".jpg") {
    // const thumbnailPath = `https://the-last-poster-show.nyc3.digitaloceanspaces.com/image-storage/thumbnails/${thumbnailKey}.png`;
    try {
      const image1 = await Jimp.read(fullImagePath);
      // const thumbnailImage = await Jimp.read(thumbnailPath);
      const scaledFullImage = image1.scale(0.05);

      // Perform pixel diff
      const diff = Jimp.diff(thumbnailImage, scaledFullImage);
      const hashDistance = Jimp.distance(thumbnailImage, scaledFullImage);
      console.log(`${thumbnailKey}: ${hashDistance}`);
      return { hashDistance, diff };
    } catch (err) {
      console.log(err);
    }
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

// await findMatch(
//   "https://the-last-poster-show.nyc3.digitaloceanspaces.com/image-storage/full-size/20220427_200117.jpg",
//   [
//     "maciste-in-king-solomons-mines-style-1",
//     "maciste-gladiatore-di-sparta-style-1",
//   ]
// );

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
      isTruncated = false;

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
