// Import necessary modules
const axios = require("axios");
const fs = require("fs");
const path = require("path");

// Function to handle user input and initiate the process
function getUserInputAndFetch() {
  const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Prompt user for Instagram username
  readline.question("Enter Instagram username: ", (username) => {
    // Fetch user ID and initiate feed retrieval
    fetchUserId(username)
      .then((userId) => {
        fetchFeed(userId, username);
        readline.close();
      })
      .catch((error) => {
        console.error("Error:", error.message);
        readline.close();
      });
  });
}

// Base URL for Instagram feed
const baseFeedUrl = "https://www.instagram.com/api/v1/feed/user/";

// Your cookies and headers
const cookie = '...'; // Replace with your actual cookie value
const userAgent =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1";

const headers = {
  Cookie: cookie,
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
  "User-Agent": userAgent,
  "Viewport-Width": "430",
  "X-Asbd-Id": "129477",
  "X-Ig-App-Id": "1217981644879628",
  "X-Ig-Www-Claim": "hmac.AR38bJjwvCYi8tKF_9I5XYtMbWh91oYFvuO9h7H9Dq1eIpCm",
  "X-Requested-With": "XMLHttpRequest",
};

// Function to fetch user ID from the initial endpoint
function fetchUserId(username) {
  const initialFeedUrl = `${baseFeedUrl}${username}/username/?count=12`;

  return axios
    .get(initialFeedUrl, { headers: headers })
    .then((response) => {
      const data = response.data;
      if (data.user && data.user.pk_id) {
        return data.user.pk_id;
      } else {
        throw new Error("Error: Unable to get user ID from the response.");
      }
    })
    .catch((error) => {
      console.error("Error fetching user ID:", error.message);
      throw error;
    });
}

// Function to fetch feed with user_id and max_id
function fetchFeed(userId, username, maxId = null, postNumber = 1) {
  let feedUrl = `${baseFeedUrl}${userId}/?count=12`;

  if (maxId) {
    feedUrl += `&max_id=${maxId}`;
  }

  axios
    .get(feedUrl, { headers: headers })
    .then((response) => {
      const data = response.data;

      if (data.items && data.items.length > 0) {
        data.items.forEach((item, index) => {
          const postIndex = postNumber + index;
          console.log(`Post Ke - ${postIndex} dari ${username}`);

          // Check if post is a carousel
          if (item.carousel_media && item.carousel_media.length > 0) {
            item.carousel_media.forEach((carouselItem, carouselIndex) => {
              // Check if carousel item is a video
              if (
                carouselItem.video_versions &&
                carouselItem.video_versions.length > 0
              ) {
                const videoUrl = carouselItem.video_versions[0].url;
                // Download carousel video
                downloadMedia(
                  username,
                  videoUrl,
                  "video",
                  carouselItem.taken_at,
                  carouselIndex + 1
                );
              } else if (carouselItem.image_versions2) {
                const imageUrl = carouselItem.image_versions2.candidates[0].url;
                // Download carousel image
                downloadMedia(
                  username,
                  imageUrl,
                  "image",
                  carouselItem.taken_at,
                  carouselIndex + 1
                );
              }
            });
          } else if (item.video_versions && item.video_versions.length > 0) {
            const videoUrl = item.video_versions[0].url;
            // Download single video
            downloadMedia(username, videoUrl, "video", item.taken_at);
          } else if (item.image_versions2) {
            const imageUrl = item.image_versions2.candidates[0].url;
            // Download single image
            downloadMedia(username, imageUrl, "image", item.taken_at);
          }
        });
      }

      const nextMaxId = data.next_max_id;
      if (nextMaxId) {
        // Recursive call to fetch next set of posts
        fetchFeed(userId, username, nextMaxId, postNumber + data.items.length);
      }
    })
    .catch((error) => {
      console.error("Error fetching feed:", error.message);
    });
}

// Function to download media (image or video)
function downloadMedia(
  username,
  mediaUrl,
  mediaType,
  timestamp,
  carouselIndex
) {
  const folderPath = path.join(__dirname, username, "Posts");
  const indexSuffix = carouselIndex ? `_${carouselIndex}` : "";
  const fileExtension = mediaType === "video" ? "mp4" : "jpg";

  const formattedDateTime = getFormattedDateTime(timestamp);
  const fileName = `${username}_${formattedDateTime}${indexSuffix}.${fileExtension}`;
  const filePath = path.join(folderPath, fileName);

  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  if (fs.existsSync(filePath)) {
    console.log(`File already exists: ${filePath}. Skipping download.`);
    return;
  }

  axios({
    method: "get",
    url: mediaUrl,
    responseType: "stream",
    headers: headers,
  })
    .then((response) => {
      // Write the media stream to file
      response.data.pipe(fs.createWriteStream(filePath));
      console.log(`Downloaded: ${filePath}`);
    })
    .catch((error) => {
      console.error("Error downloading media:", error.message);
    });
}

// Function to format timestamp into a readable date-time string
function getFormattedDateTime(timestamp) {
  const jakartaTime = new Date(timestamp * 1000);

  // Get local time components
  const year = jakartaTime.getFullYear();
  const month = String(jakartaTime.getMonth() + 1).padStart(2, "0");
  const day = String(jakartaTime.getDate()).padStart(2, "0");
  const hours = String(jakartaTime.getHours()).padStart(2, "0");
  const minutes = String(jakartaTime.getMinutes()).padStart(2, "0");
  const seconds = String(jakartaTime.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

// Initiate the script by getting user input
getUserInputAndFetch();
