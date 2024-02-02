const axios = require("axios");
const fs = require("fs");
const path = require("path");

const baseFeedUrl = "https://www.instagram.com/api/v1/feed/user/";

// Your cookies and headers
const cookie =
  '...'
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

function clearConsole() {
  if (process.platform === "win32") {
    require("child_process").spawnSync("cmd", ["/c", "cls"], {
      stdio: "inherit",
    });
  } else {
    console.clear();
  }
}

function getUserInputAndFetch() {
  clearConsole();

  console.log("Choose an option:");
  console.log("1. Download all posts");
  console.log("2. Exit");

  const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  readline.question("Enter your choice (1 or 2): ", (choice) => {
    if (choice === "1") {
      readline.question("Enter Instagram username: ", (username) => {
        fetchUserIdAndFetchFeed(username);
        readline.close();
      });
    } else if (choice === "2") {
      console.log("Exiting the program.");
      readline.close();
    } else {
      console.log("Invalid choice. Please enter 1 or 2.");
      readline.close();
    }
  });
}

function fetchUserIdAndFetchFeed(username) {
  fetchUserId(username)
    .then((userId) => {
      fetchFeed(userId, username);
    })
    .catch((error) => {
      console.error("Error:", error.message);
    });
}

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

async function fetchFeed(userId, username, maxId = null, postNumber = 1) {
  let feedUrl = `${baseFeedUrl}${userId}/?count=12`;

  if (maxId) {
    feedUrl += `&max_id=${maxId}`;
  }

  const response = await axios.get(feedUrl, { headers: headers });
  const data = response.data;

  if (data.items && data.items.length > 0) {
    totalPostsToDownload = data.items.length;
    for (const item of data.items) {
      const postIndex = postNumber + postNumber - 1;

      if (item.carousel_media && item.carousel_media.length > 0) {
        for (
          let carouselIndex = 1;
          carouselIndex <= item.carousel_media.length;
          carouselIndex++
        ) {
          await handleCarouselItem(
            username,
            item.carousel_media[carouselIndex - 1],
            carouselIndex
          );
        }
      } else {
        await handleSingleItem(username, item);
      }
    }
  }

  const nextMaxId = data.next_max_id;
  if (nextMaxId) {
    await fetchFeed(
      userId,
      username,
      nextMaxId,
      postNumber + data.items.length
    );
  } else {
    console.log("All downloads are complete!");
  }
}

async function handleCarouselItem(username, carouselItem, carouselIndex) {
  if (carouselItem.video_versions && carouselItem.video_versions.length > 0) {
    const videoUrl = carouselItem.video_versions[0].url;
    await downloadMedia(
      username,
      videoUrl,
      "video",
      carouselItem.taken_at,
      carouselIndex
    );
  } else if (carouselItem.image_versions2) {
    const imageUrl = carouselItem.image_versions2.candidates[0].url;
    await downloadMedia(
      username,
      imageUrl,
      "image",
      carouselItem.taken_at,
      carouselIndex
    );
  }
}

async function handleSingleItem(username, item) {
  if (item.video_versions && item.video_versions.length > 0) {
    const videoUrl = item.video_versions[0].url;
    await downloadMedia(username, videoUrl, "video", item.taken_at);
  } else if (item.image_versions2) {
    const imageUrl = item.image_versions2.candidates[0].url;
    await downloadMedia(username, imageUrl, "image", item.taken_at);
  }
}

function downloadMedia(
  username,
  mediaUrl,
  mediaType,
  timestamp,
  carouselIndex,
  retries = 3
) {
  return new Promise((resolve, reject) => {
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
      console.log(`File already exists: ${fileName}. Skipping download.`);
      resolve();
    } else {
      axios({
        method: "get",
        url: mediaUrl,
        responseType: "stream",
        headers: headers,
        timeout: 10000,
      })
        .then((response) => {
          response.data
            .pipe(fs.createWriteStream(filePath))
            .on("finish", () => {
              console.log(`Download Complete: ${fileName}`);
              resolve();
            });
        })
        .catch((error) => {
          console.error("Error downloading media:", error.message);

          if (retries > 0) {
            console.log(`Retrying download (${retries} retries left)...`);
            setTimeout(() => {
              downloadMedia(
                username,
                mediaUrl,
                mediaType,
                timestamp,
                carouselIndex,
                retries - 1
              )
                .then(resolve)
                .catch(reject);
            }, 3000);
          } else {
            console.error("Download failed after retries.");
            reject(error);
          }
        });
    }
  });
}

function getFormattedDateTime(timestamp) {
  const jakartaTime = new Date(timestamp * 1000);

  const year = jakartaTime.getFullYear();
  const month = String(jakartaTime.getMonth() + 1).padStart(2, "0");
  const day = String(jakartaTime.getDate()).padStart(2, "0");
  const hours = String(jakartaTime.getHours()).padStart(2, "0");
  const minutes = String(jakartaTime.getMinutes()).padStart(2, "0");
  const seconds = String(jakartaTime.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

getUserInputAndFetch();
