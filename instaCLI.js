// Import necessary modules
const axios = require("axios");
const fs = require("fs");
const path = require("path");

// Base URL for Instagram feed
const baseFeedUrl = "https://www.instagram.com/api/v1/feed/user/";

// Your Instagram cookies and headers
const cookie = "...";
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


// Function to clear the console based on the platform
function clearConsole() {
    if (process.platform === "win32") {
        require("child_process").spawnSync("cmd", ["/c", "cls"], {
            stdio: "inherit",
        });
    } else {
        console.clear();
    }
}
// Function to fetch user ID and then fetch stories
async function fetchUserIdAndFetchStories(username) {
    try {
        // Fetch user ID using the provided username
        const userId = await fetchUserId(username);
        // Pass the username and user ID to fetchStories function
        fetchStories(username, userId);
    } catch (error) {
        console.error("Error:", error.message);
    }
}

// Function to download Instagram stories
async function downloadStories(username, story) {
    return new Promise(async (resolve, reject) => {
        // Set up folder path to save stories
        const folderPath = path.join(__dirname, username, "Stories");

        // Generate formatted file name based on timestamp and media type
        const formattedDateTime = getFormattedDateTime(story.taken_at);
        const fileExtension = story.video_versions ? "mp4" : "jpg";
        const fileName = `${username}_stories_${formattedDateTime}.${fileExtension}`;
        const filePath = path.join(folderPath, fileName);

        // Check if the folder exists, if not, create it
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, {
                recursive: true
            });
        }

        // Check if the file already exists, if not, download the story
        if (fs.existsSync(filePath)) {
            console.log(`File already exists: ${fileName}. Skipping download.`);
            resolve();
        } else {
            try {
                const mediaUrl = story.video_versions ?
                    story.video_versions[0].url :
                    story.image_versions2.candidates[0].url;

                // Use Axios to download the media stream and save it to the file
                const response = await axios.get(mediaUrl, {
                    responseType: "stream",
                    headers: headers,
                    timeout: 10000,
                });

                // Pipe the response stream to a writable stream (file)
                response.data.pipe(fs.createWriteStream(filePath)).on("finish", () => {
                    console.log(`Download Complete: ${fileName}`);
                    resolve(); // Resolve the promise after the download is complete
                });
            } catch (error) {
                console.error("Error downloading story media:", error.message);
                reject(error); // Reject the promise if there's an error during download
            }
        }
    });
}
// Function to fetch stories based on username and user ID
async function fetchStories(username, userId) {
    // Construct the URL for fetching stories
    const storiesUrl = `https://www.instagram.com/api/v1/feed/reels_media/?reel_ids=${userId}`;

    try {
        // Make a GET request to fetch stories
        const response = await axios.get(storiesUrl, {
            headers: headers
        });
        const data = response.data;

        // Check if stories are available in the response
        if (data.reels_media && data.reels_media.length > 0) {
            const items = data.reels_media[0].items;
            let downloadedCount = 0;

            // Create an array to store promises for each download
            const downloadPromises = [];

            // Iterate through each story item and initiate download
            for (const item of items) {
                if (item.video_versions && item.video_versions.length > 0) {
                    const isDownloaded = await isStoryDownloaded(username, item);
                    if (!isDownloaded) {
                        // Initiate download and add the promise to the array
                        downloadPromises.push(downloadStories(username, item));
                        downloadedCount++;
                    }
                } else if (item.image_versions2) {
                    const isDownloaded = await isStoryDownloaded(username, item);
                    if (!isDownloaded) {
                        downloadPromises.push(downloadStories(username, item));
                        downloadedCount++;
                    }
                }
            }

            // Wait for all download promises to resolve
            await Promise.all(downloadPromises);

            // Display appropriate message based on download status
            if (downloadedCount > 0) {
                console.log(`Now all the stories have been downloaded.`);
            } else {
                console.log(
                    `Nothing has been downloaded, everything has been downloaded.`
                );
            }
        } else {
            console.log("No stories found for this user.");
        }
        const downloadMore = await askToDownloadMore();
        if (downloadMore) {
            getUserInputAndFetch(); // Restart the program
        } else {
            console.log("Exiting the program.");
        }
    } catch (error) {
        console.error("Error fetching stories:", error.message);
        getUserInputAndFetch();
    }
}
// Function to check if a story has already been downloaded
async function isStoryDownloaded(username, story) {
    const formattedDateTime = getFormattedDateTime(story.taken_at);
    const fileExtension = story.video_versions ? "mp4" : "jpg";
    const fileName = `${username}_stories_${formattedDateTime}.${fileExtension}`;
    const filePath = path.join(__dirname, username, "Stories", fileName);

    // Check if the file already exists
    return fs.existsSync(filePath);
}
async function getUserInputAndFetch() {
    clearConsole();

    console.log("Choose an option:");
    console.log("1. Download all posts");
    console.log("2. Download stories");
    console.log("3. Exit");

    const readline = require("readline").createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    readline.question("Enter your choice (1, 2, or 3): ", async (choice) => {
        switch (choice) {
            case "1":
                // If choice is 1, prompt for Instagram username and initiate post download
                readline.question("Enter Instagram username: ", (username) => {
                    fetchUserIdAndFetchFeed(username);
                    readline.close();
                });
                break;
            case "2":
                // If choice is 2, prompt for Instagram username and initiate story download
                readline.question("Enter Instagram username: ", (username) => {
                    fetchUserIdAndFetchStories(username);
                    readline.close();
                });
                break;
            case "3":
                // If choice is 3, exit the program
                console.log("Exiting the program.");
                readline.close();
                break;
            default:
                // Handle invalid choices
                console.log("Invalid choice. Please enter 1, 2, or 3.");
                readline.close();
                break;
        }
    });
}

// Define an asynchronous function that prompts the user to confirm if they want to download more posts/stories
async function askToDownloadMore() {
    // Return a Promise that resolves to the user's choice
    return new Promise((resolve) => {
        // Create an interface to read user input from the console
        const readline = require("readline").createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        // Ask the user for input and resolve the Promise based on their response
        readline.question(
            "Do you want to download more posts/stories? (Y/n): ",
            (answer) => {
                // Close the readline interface after getting the answer
                readline.close();
                // Resolve the Promise with a boolean indicating the user's choice
                resolve(answer.toLowerCase() === "y");
            }
        );
    });
}

// Function to fetch user ID based on the given username and initiate the post download process
function fetchUserIdAndFetchFeed(username) {
    // Fetch the user ID using the provided username
    fetchUserId(username)
        .then((userId) => {
            // Once the user ID is obtained, initiate the process of fetching the user's feed using the fetched user ID and username
            fetchFeed(userId, username);
        })
        .catch((error) => {
            // If there's an error during the process, log the error message to the console
            console.error("Error:", error.message);
        });
}

// Function to fetch user ID based on the provided username
function fetchUserId(username) {
    // Construct the initial feed URL for fetching user ID
    const initialFeedUrl = `${baseFeedUrl}${username}/username/?count=12`;

    // Make a GET request to fetch user ID
    return axios
        .get(initialFeedUrl, {
            headers: headers
        })
        .then((response) => {
            const data = response.data;
            // Check if user ID is available in the response
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

// Function to fetch and download user posts recursively
async function fetchFeed(userId, username, maxId = null, postNumber = 1) {
    let feedUrl = `${baseFeedUrl}${userId}/?count=12`;

    // Append max_id if provided
    if (maxId) {
        feedUrl += `&max_id=${maxId}`;
    }

    // Make a GET request to fetch user feed
    const response = await axios.get(feedUrl, {
        headers: headers
    });
    const data = response.data;

    // Check if posts are available in the response
    if (data.items && data.items.length > 0) {
        totalPostsToDownload = data.items.length;

        // Iterate through each post item
        for (const item of data.items) {
            const postIndex = postNumber + postNumber - 1;

            // Check if the post is a carousel with multiple media
            if (item.carousel_media && item.carousel_media.length > 0) {
                // Iterate through each carousel item and handle it
                for (
                    let carouselIndex = 1; carouselIndex <= item.carousel_media.length; carouselIndex++
                ) {
                    await handleCarouselItem(
                        username,
                        item.carousel_media[carouselIndex - 1],
                        carouselIndex
                    );
                }
            } else {
                // Handle single media post
                await handleSingleItem(username, item);
            }
        }
    }

    // Check if there is a next_max_id, fetch the next page of posts recursively
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

        // Ask the user if they want to download more posts
        const downloadMore = await askToDownloadMore();
        if (downloadMore) {
            getUserInputAndFetch(); // Restart the program
        } else {
            console.log("Exiting the program.");
        }
    }
}

// Function to handle carousel items (multiple media in a post)
async function handleCarouselItem(username, carouselItem, carouselIndex) {
    if (carouselItem.video_versions && carouselItem.video_versions.length > 0) {
        const videoUrl = carouselItem.video_versions[0].url;
        // Download carousel video
        await downloadMedia(
            username,
            videoUrl,
            "video",
            carouselItem.taken_at,
            carouselIndex
        );
    } else if (carouselItem.image_versions2) {
        const imageUrl = carouselItem.image_versions2.candidates[0].url;
        // Download carousel image
        await downloadMedia(
            username,
            imageUrl,
            "image",
            carouselItem.taken_at,
            carouselIndex
        );
    }
}

// Function to handle single media items (non-carousel)
async function handleSingleItem(username, item) {
    if (item.video_versions && item.video_versions.length > 0) {
        const videoUrl = item.video_versions[0].url;
        // Download single video
        await downloadMedia(username, videoUrl, "video", item.taken_at);
    } else if (item.image_versions2) {
        const imageUrl = item.image_versions2.candidates[0].url;
        // Download single image
        await downloadMedia(username, imageUrl, "image", item.taken_at);
    }
}

// Function to download media (image or video) with retry mechanism
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

        // Check if the folder exists, if not, create it
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, {
                recursive: true
            });
        }

        // Check if the file already exists, if yes, skip download
        if (fs.existsSync(filePath)) {
            console.log(`File already exists: ${fileName}. Skipping download.`);
            resolve();
        } else {
            // Use Axios to download the media stream and save it to the file
            axios({
                    method: "get",
                    url: mediaUrl,
                    responseType: "stream",
                    headers: headers,
                    timeout: 10000,
                })
                .then((response) => {
                    // Pipe the response stream to a writable stream (file)
                    response.data
                        .pipe(fs.createWriteStream(filePath))
                        .on("finish", () => {
                            console.log(`Download Complete: ${fileName}`);
                            resolve();
                        });
                })
                .catch((error) => {
                    console.error("Error downloading media:", error.message);

                    // Retry the download if there are retries left
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

// Function to format timestamp into a string
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

// Start the program by prompting the user for input
getUserInputAndFetch();
