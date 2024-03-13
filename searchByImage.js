import Jimp from "jimp";
import {
  S3Client,
  // This command supersedes the ListObjectsCommand and is the recommended way to list objects.
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import * as fs from "fs";
import { parse } from "csv-parse";
import { finished } from "stream/promises";

export async function compareImages(fullImage, thumbnail) {
  try {
    const scaledFullImage = fullImage.scale(0.05);
    const fullImageRatio = fullImage.bitmap.width / fullImage.bitmap.height;

    if (thumbnail) {
      const thumbnailRatio =
        thumbnail.image.bitmap.width / thumbnail.image.bitmap.height;
      const ratioDiff = fullImageRatio / thumbnailRatio;
      // Perform pixel diff
      const diff = Jimp.diff(thumbnail.image, scaledFullImage);
      const hashDistance = Jimp.distance(thumbnail.image, scaledFullImage);
      console.log(thumbnail.image.bitmap.width);
      return { hashDistance, diff, ratioDiff };
    }
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
    // Delimiter: "/",
    MaxKeys: 10,
    // StartAfter: 1000,
    Prefix: "image-storage/full-size/",
  });
  const imageList = [];

  try {
    let isTruncated = true;
    while (isTruncated) {
      const { Contents, IsTruncated, NextContinuationToken } =
        await client.send(command);
      imageList.push(
        ...Contents.map((c, i) => {
          return `https://the-last-poster-show.nyc3.digitaloceanspaces.com/${c.Key}`;
        })
      );
      // isTruncated = IsTruncated;
      isTruncated = false;
      command.input.ContinuationToken = NextContinuationToken;
    }
  } catch (err) {
    console.error(err);
  }
  return imageList;
};

export const getThumbnails = async () => {
  const command = new ListObjectsV2Command({
    Bucket: "the-last-poster-show",
    // Delimiter: "/",
    MaxKeys: 100,
    // StartAfter: 1000,
    Prefix: "image-storage/thumbs/",
  });
  const imageList = [];

  try {
    let isTruncated = true;
    while (isTruncated) {
      const { Contents, IsTruncated, NextContinuationToken } =
        await client.send(command);
      imageList.push(
        ...Contents.map((c) => {
          return new String(c.Key.slice(21, -4)).toString();
        })
      );
      isTruncated = IsTruncated;
      // isTruncated = false;
      command.input.ContinuationToken = NextContinuationToken;
    }
  } catch (err) {
    console.error(err);
  }

  // Array of strings to write to the file
  const stringsToWrite = imageList.filter((imagePath) => imagePath.length > 8);

  // File path where you want to write the data
  const filePath = "output.txt";

  // Function to write the list of strings to a text file
  function writeStringsToFile(strings, filePath) {
    const quotedData = strings.map((string) => `"${string}",`);
    // Join the strings with newline character to form lines
    const data = quotedData.join("\n");

    // Write data to the file
    fs.writeFile(filePath, data, (err) => {
      if (err) {
        console.error("Error writing to file:", err);
      } else {
        console.log("Data written to file successfully.");
      }
    });
  }

  // Call the function to write the strings to the file
  // writeStringsToFile(stringsToWrite, filePath);

  return stringsToWrite;
};

// await getThumbnails();

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
