import { hammingDistance } from "img-hasher";
import Jimp from "jimp";

const imageList = ["image1.jpg", "image2.jpg", "image3.jpg"]; // List of image paths
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
  "maciste-gladiatore-di-sparta-style-1",
  "smoky-canyon-style-1",
  "true-confessions-style-1",
  "the-lemon-drop-kid-style-1",
];

const referenceImageUris = [
  { title: "True Confessions", key: "20221229_101021.jpg" },
  { title: "Smoky Canyon", key: "20230101_101242.jpg" },
  { title: "Lemon Drop Kid", key: "20230103_145538.jpg" },
];

export function findOutlierThreshold(numbers) {
  // Step 1: Sort the numbers in ascending order
  const sortedNumbers = numbers.slice().sort((a, b) => a - b);

  // Step 2: Calculate the first quartile (Q1)
  const q1Index = Math.floor((sortedNumbers.length - 1) / 4);
  const q1 = sortedNumbers[q1Index];

  // Step 3: Calculate the third quartile (Q3)
  const q3Index = Math.ceil(((sortedNumbers.length - 1) * 3) / 4);
  const q3 = sortedNumbers[q3Index];

  // Step 4: Calculate the interquartile range (IQR)
  const iqr = q3 - q1;

  // Step 5: Calculate the lower and upper bounds for outliers
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  return lowerBound;
}

export async function getSimilarKeys(referenceImageObject, compareImageList) {
  try {
    const hash1 = await referenceImageObject.image.hash(2);
    const scores = await Promise.all(
      compareImageList.map(async (targetImage) => {
        try {
          const hash2 = targetImage?.image?.hash(2);
          const croppedTarget = targetImage.image.autocrop({
            tolerance: 0.2,
            cropOnlyFrames: false,
          });
          const hash2cropped = croppedTarget.hash(2);
          const hashDist = Math.abs(1 - hash1 / hash2);
          const hashDistCropped = Math.abs(1 - hash1 / hash2cropped);
          const hamDist = Jimp.distance(
            referenceImageObject.image,
            targetImage.image
          );
          const match = {
            key: targetImage?.key,
            hashDist,
            hashDistCropped,
            hamDist,
          };
          // console.log(match);
          return match;
        } catch (err) {
          console.log(
            `Could not compare thumbnail ${targetImage?.key}: ${err}`
          );
        }
      })
    );
    const filteredScores = scores.filter((match) => {
      const hashMatch =
        match.hashDist === match.hashDistCropped && match.hashDist < 0.000001;
      const hamMatch = match.hamDist < 0.295;
      if (hashMatch && hamMatch) {
        return true;
      }
      return false;
    });
    if (filteredScores.length > 0) {
      return filteredScores;
    }

    return false;
  } catch (err) {
    console.log(`Could not hash reference image: ${err}`);
  }
}
