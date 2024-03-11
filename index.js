import {
  writeMatchesToRemoteSheet,
  openSpreadsheet,
} from "./remoteSpreadsheets.js";
import { compareImages, getFullImages, getAllKeys } from "./searchByImage.js";
import Jimp from "jimp";

const batchComparing = async (fullImage, thumbnailList) => {
  const batchSize = 3; // Adjust the batch size as needed
  const batches = [];
  const allPotentialMatches = [];
  for (let i = 0; i < thumbnailList.length; i += batchSize) {
    batches.push(thumbnailList.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    const potentialMatches = [];
    for (const thumbnail of batch) {
      try {
        const { hashDistance, diff } = await compareImages(
          fullImage,
          thumbnail
        );
        if (hashDistance < 0.2) {
          potentialMatches.push({
            thumbnailKey: thumbnail.key,
            diff,
            hashDistance,
          });
        }
      } catch (error) {
        console.error(`Error processing image ${thumbnail.key}:`, error);
      }
    }
    allPotentialMatches.push(...potentialMatches);
  }
  return allPotentialMatches;
};

const batchMatching = async (imageList, thumbnailImages) => {
  console.log("Begin matching...");
  const doc = await openSpreadsheet(
    "1xqEAFXMvqQghKSVj8xtijrhc-MK6Qx1vvik_1H6ZhNE"
  );

  const batchSize = 3; // Adjust the batch size as needed
  const batches = [];
  for (let i = 0; i < imageList.length; i += batchSize) {
    batches.push(imageList.slice(i, i + batchSize));
  }
  for (const batch of batches) {
    for (const fullImagePath of batch) {
      if (
        typeof fullImagePath === "string" &&
        fullImagePath.slice(-4) === ".jpg"
      ) {
        const fullImage = await Jimp.read(fullImagePath);
        try {
          console.log(`Matching ${fullImagePath.slice(-20)}...`);
          const matches = await batchComparing(fullImage, thumbnailImages);

          let sortedMatches = [];
          if (matches?.length > 0) {
            sortedMatches = matches
              .filter((match) => match.diff.percent < 0.00007)
              .sort((a, b) => a.diff.percent - b.diff.percent);
          }
          const sortedMatchKeys = sortedMatches.map(
            (match) => match.thumbnailKey
          );
          await writeMatchesToRemoteSheet(doc, fullImagePath, sortedMatchKeys);
        } catch (error) {
          await writeErrorToRemoteSheet(doc, fullImagePath);
        }
      }
    }
  }
};

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
  "the-house-across-the-bay-style-1",
  "the-living-daylights-style-1",
  "the-living-daylights-style-2",
  "maciste-in-king-solomons-mines-style-1",
  // "maciste-in-king-solomons-mines-style-2",
  // "maciste-in-king-solomons-mines-style-3",
  "maciste-gladiatore-di-sparta-style-1",
  "smoky-canyon-style-1",
];

const { keys } = await getAllKeys();
const fullImagePaths = await getFullImages();
// const keys = testKeys;

const batchSize = 5; // Adjust the batch size as needed
const batches = [];
for (let i = 0; i < keys.length; i += batchSize) {
  batches.push(keys.slice(i, i + batchSize));
}
const allThumbnails = [];
for (const batch of batches) {
  const thumbnailImages = await Promise.all(
    batch.map(async (key) => {
      const thumbnailPath = `https://the-last-poster-show.nyc3.digitaloceanspaces.com/image-storage/thumbnails/${key}.png`;
      const image = await Jimp.read(thumbnailPath);
      return { key, image };
    })
  );
  allThumbnails.push(...thumbnailImages);
}

await batchMatching(fullImagePaths, allThumbnails);
console.log("Matching complete!");
