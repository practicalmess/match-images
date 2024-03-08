import getRemoteSpreadsheet from "./remoteSpreadsheets.js";
import { compareImages, getFullImages, getAllKeys } from "./searchByImage.js";
import { parse } from "csv-parse";
import * as fs from "fs";
import { finished } from "stream/promises";

// writeToCSV(["Key", "Price", "Title", "Image URI", "Genre", "Tags", "Category"]);

// async function writeToRemoteSheet(rowData, sheetId) {}

const batchComparing = async (fullImage, thumbnailList) => {
  const batchSize = 5; // Adjust the batch size as needed
  const batches = [];
  const allPotentialMatches = [];
  for (let i = 0; i < thumbnailList.length; i += batchSize) {
    batches.push(thumbnailList.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    const potentialMatches = [];
    for (const thumbnailKey of batch) {
      try {
        const { hashDistance, diff } = await compareImages(
          fullImage,
          thumbnailKey
        );
        if (hashDistance < 0.16) {
          console.log(`${fullImage.slice(-12)} might match ${thumbnailKey}`);
          potentialMatches.push({ thumbnailKey, diff });
        }
        // const similarityScore = await compareImages(fullImage, thumbnailKey);
        // if (similarityScore < 0.16) {
        //   console.log(
        //     `${fullImage.slice(
        //       -20
        //     )} potential match: ${thumbnailKey} (${similarityScore})`
        //   );
        //   potentialMatches.push(thumbnailKey);

        // scores.push({ key: thumbnail.slice(19, -4), similarityScore });
        // }
      } catch (error) {
        console.error(`Error processing image ${thumbnailKey}:`, error);
      }
      allPotentialMatches.push(...potentialMatches);
    }
  }
  return allPotentialMatches;
};

const batchMatching = async (imageList, thumbnailList) => {
  const batchSize = 1; // Adjust the batch size as needed
  const batches = [];
  for (let i = 0; i < imageList.length; i += batchSize) {
    batches.push(imageList.slice(i, i + batchSize));
  }
  const results = [];
  for (const batch of batches) {
    for (const fullImage of batch) {
      try {
        const matches = await batchComparing(fullImage, thumbnailList);
        if (matches?.length > 0) {
          matches.sort((a, b) => a.diff.percent - b.diff.percent);
          results.push({ imageUri: fullImage, key: matches[0].thumbnailKey });
        }
      } catch (error) {
        console.error(`Error processing image ${fullImage.slice(-14)}:`, error);
        return null; // or handle the error as needed
      }
    }
  }
  return results;
};

async function matchImages(fullImages, keys, keyedInfo) {
  const potentialMatches = await batchMatching(fullImages, keys.slice(1, 10));
  console.log(potentialMatches);
  // const matchingKey = await findMatch(image, keys);
  // if (matchingKey) {
  // const matchingRows = keyedInfo.filter((row) => row.key === matchingKey);
  // if (matchingRows.length > 0) {
  //   console.log(`Matching key:  ${matchingRows[0].key}`);
  // }
  // } else {
  //   console.log("No match found");
  // }

  // const matchingKey = await findMatch(fullImages[0], keys);
  // console.log(`Matching key: ${matchingKey}`);
  // const matchingRow = info.filter((row) => row[0] === matchingKey);
  // console.log(matchingRow);
}

const { keys, keyedInfo } = await getAllKeys();

const testKeys = [
  "northwest-passage-style-1",
  "the-desperate-hours-style-3",
  "the-story-of-g.i-joe-style-1",
  "best-years-of-our-lives-style-1",
  "the-yearling-style-1",
  "bend-of-the-river-style-1",
  "bend-of-the-river-style-2",
  "bend-of-the-river-style-3",
  "seventh-heaven-style-1",
  "the-house-across-the-bay-style-",
  "the-living-daylights-style-1",
  "the-living-daylights-style-2",
];

const fullImages = await getFullImages();
const slicedKeys = keys.slice(1, 10).push("the-living-daylights-style-2");
const matches = await batchMatching(
  [
    "https://the-last-poster-show.nyc3.cdn.digitaloceanspaces.com/image-storage/full-size/20230106_104304.jpg",
  ],
  ["true-confessions-style-1", ...testKeys]
);
console.log(matches);

// await matchImages();

// const doc = await getRemoteSpreadsheet(
//   "1afVxSIoKYs5m7-HH4ey2N-P2AOcgpD-rThSU9B82aZQ"
// );
// console.log(doc);
