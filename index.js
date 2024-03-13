import {
  writeMatchesToRemoteSheet,
  writeErrorToRemoteSheet,
  openSpreadsheet,
} from "./remoteSpreadsheets.js";
import {
  compareImages,
  getFullImages,
  getThumbnails,
} from "./searchByImage.js";
import { getSimilarKeys, findOutlierThreshold } from "./computeSimilarity.js";
import Jimp from "jimp";
import { allKeys, someKeys } from "./allKeys.js";

const getMatchScores = (matches) => {
  // const { matchByCroppedHash, matchByHash, matchByHam } = matches;
  let hamScore = 0;
  let cropScore = 0;
  let hashScore = 0;
  matches.forEach((match) => {
    if (match.key === matches[2].key) {
      hamScore++;
    }
    if (match.key === matches[1].key) {
      hashScore++;
    }
    if (match.key === matches[0].key) {
      cropScore++;
    }
  });
  return { hamScore, hashScore, cropScore };
};

const batchComparing = async (fullImage, thumbnailObjectList) => {
  const batchSize = 50; // Adjust the batch size as needed
  const batches = [];
  const allPotentialMatches = [];
  // console.log(thumbnailObjectList.length);
  for (let i = 0; i < thumbnailObjectList.length; i += batchSize) {
    batches.push(thumbnailObjectList.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    console.log("Beginning batch...");
    const allScores = await getSimilarKeys(fullImage, batch);
    if (allScores) {
      allPotentialMatches.push(...allScores);
    }
  }
  return allPotentialMatches;
};

const getTopHashMatch = (scores) => {
  // const values = scores.map((score) => score.hashDist);
  const sortedValues = scores.slice().sort((a, b) => a.hashDist - b.hashDist);

  return sortedValues[0];
};

const batchMatching = async (imageList, thumbnailObjects) => {
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
        const fullImageObject = { image: fullImage, path: fullImagePath };
        try {
          console.log(`Matching ${fullImagePath.slice(-20)}...`);
          const matches = await batchComparing(
            fullImageObject,
            thumbnailObjects
          );
          await writeMatchesToRemoteSheet(
            doc,
            fullImagePath,
            matches.map((match) => match.key)
          );
        } catch (error) {
          console.log(error);
          // await writeErrorToRemoteSheet(doc, fullImagePath);
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
  "treasure-of-matecumbe-style-1",
  "two-on-a-guillotine-style-1",
  "when-taekwondo-strikes-style-1",
  "a-boy-and-his-dog-style-1",
  "a-bucket-of-blood-style-1",
  "a-coming-of-angels-style-1",
  "9-to-5-style-1",
  "4-clowns-style-1",
  "a-gathering-of-eagles-style-1",
  "2001;-a-space-odyssey-style-1",
  "3-on-a-couch-style-1",
  "5-fingers-style-1",
  "7-faces-of-dr.-lao-style-1",
  "a-gathering-of--eagles-style-1",
  "a-girl-named-tamiko-style-1",
  "3-steps-to-the-gallows-style-1",
  "40-guns-to-apache-pass-style-1",
  "a-guide-to-the-married-man-style-1",
  "101-dalmatians-style-1",
  "13-ghosts-style-1",
  "13-rue-madeleine-style-1",
  "20,000-leagues-under-the-sea-style-1",
  "20,000-years-in-sing-sing-style-1",
  "20-million-miles-to-earth-style-1",
  "2001-a-space-odyssey-style-1",
  "23-12-hours-leave-style-1",
  "3-brave-men-style-1",
  "3-godfathers-style-1",
  "3-godfathers-style-2",
  "3-on-the-trail-style-1",
  "3-ring-circus-style-2",
  "30-years-of-fun-style-1",
  "310-to-yuma-style-1",
  "6-bridges-to-cross-style-1",
  "633-squadron-style-1",
  "633-squadron-style-2",
  "711-ocean-drive-style-1",
  "7th-cavalry-style-1",
  "8-12-style-1",
  "a-bell-for-adano-style-1",
  "a-boy-named-charlie-brown-style-3",
  "a-boy-named-charlie-brown-style-4",
  "a-boy-named-charlie-brown-style-5",
  "a-boy-named-charlie-brown-style-6",
  "a-child-is-waiting-style-1",
  "a-child-is-waiting-style-2",
  "a-child-is-waiting-style-3",
  "a-christmas-story-style-1",
  "a-close-call-for-boston-blackie-style-1",
  "a-close-call-for-boston-blackie-style-2",
  "a-close-call-for-boston-blackie-style-3",
  "a-cry-in-the-night-style-1",
  "a-day-at-the-races-style-1",
  "a-day-at-the-races-style-2",
  "a-day-at-the-races-style-3",
  "a-day-at-the-races-style-4",
  "a-day-at-the-races-style-5",
  "a-day-at-the-races-style-6",
  "a-desperate-chance-for-ellery-queen-style-1",
  "a-fistful-of-dollars-for-a-few-dollars-style-1",
  "a-fistful-of-dollars-style-1",
  "a-fistful-of-dollars-style-2",
  "a-foreign-affair-style-1",
  "a-foreign-affair-style-2",
  "a-foreign-affair-style-3",
  "a-foreign-affair-style-5",
  "a-girl-in-every-port-style-1",
  "track-of-the-cat-style-1",
  "track-of-the-cat-style-2",
  "track-of-the-cat-style-3",
  "trackdown-style-1",
  "trader-horn-style-1",
  "trail-street-style-1",
  "trail-to-laredo-style-1",
  "trail-to-san-antone-style-1",
  "trailing-danger-style-1",
  "trailing-danger-style-2",
  "trailing-double-trouble-style-1",
  "train-to-alcatraz-style-1",
  "transmutations-style-1",
  "trapeze-style-1",
  "trapped-by-boston-blackie-style-1",
  "treasure-island-saludos-amigos-style-1",
  "treasure-of-matecumbe-style-1",
  "treasure-of-ruby-hills-style-1",
  "tremors-style-1",
  "tremors-style-2",
  "trespass-style-1",
  "trial-style-1",
  "tribes-style-1",
  "tribute-style-1",
  "tribute-to-a-bad-man-style-1",
  "trick-baby-style-1",
  "trigger-law-style-1",
  "triggerman-style-1",
  "triple-cross-style-1",
  "tristana-style-1",
  "triumph-of-the-son-of-hecules-style-1",
  "trog-style-1",
  "tron-style-1",
  "tron-style-2",
  "trooper-hook-style-1",
  "tropic-zone-style-1",
  "tropic-zone-style-2",
  "tropic-zone-style-3",
  "trouble-along-the-way-style-1",
  "trouble-along-the-way-style-2",
  "trouble-along-the-way-style-3",
  "trouble-at-sixteen-style-1",
  "trouble-in-the-mind-style-1",
  "truck-busters-style-1",
  "true-confessions-style-1",
  "true-grit-style-1",
  "true-grit-style-2",
  "true-grit-style-3",
  "true-lies-style-1",
  "true-to-life-style-1",
  "true-to-life-style-2",
  "true-to-life-style-3",
  "tucson-raiders-style-1",
  "tumbleweed-style-1",
  "tumbleweed-trail-style-1",
  "tunes-of-glory-style-1",
  "twelve-oclock-high-style-1",
  "twelve-oclock-high-style-2",
  "twelve-oclock-high-style-3",
  "twelve-oclock-high-style-4",
  "twelve-oclock-high-style-5",
];

const testThumbs = [
  "room-service-style-1",
  "snow-white-style-1",
  "the-phantom-of-the-opera-style-1",
  "true-confessions-style-1",
];

// const fullImagePaths = await getFullImages();
// Between Heaven and Hell - correct key: between-and-heaven-and-hell-style-1
const fullImagePaths = [
  "https://the-last-poster-show.nyc3.cdn.digitaloceanspaces.com/image-storage/full-size/20230217_154305.jpg",
];
// const keys = testKeys;
// const keys = getThumbnails();
// const keys = allKeys;
const keys = someKeys;

const batchSize = 50; // Adjust the batch size as needed
const batches = [];
for (let i = 0; i < keys.length; i += batchSize) {
  batches.push(keys.slice(i, i + batchSize));
}
const allThumbnailObjects = [];
console.log("Loading thumbs...");
for (const batch of batches) {
  const thumbnailImages = await Promise.all(
    batch.map(async (key) => {
      try {
        if (key.length > 8) {
          const thumbnailPath = `https://the-last-poster-show.nyc3.digitaloceanspaces.com/image-storage/thumbs/${key}.png`;

          const image = await Jimp.read(thumbnailPath);
          return { key, image };
        }
      } catch (err) {
        console.log(`Error loading thumbnail from key: ${err}`);
      }
    })
  );
  const validThumbs = thumbnailImages.filter(
    (thumb) => thumb.key && thumb.image
  );
  await allThumbnailObjects.push(...validThumbs);
  console.log("Batch loaded");
}

await batchMatching(fullImagePaths, allThumbnailObjects);
console.log("Matching complete!");
