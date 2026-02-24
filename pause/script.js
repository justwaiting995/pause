/* ---------- SESSION ID ---------- */

let sessionId = localStorage.getItem("sessionId");

if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem("sessionId", sessionId);
}


let currentIndex = 0;
const CHUNK_SIZE = 5;
let loadedUntil = 0;

/* ---------- TRACKING SYSTEM ---------- */

let analytics = {};
let startTime = null;
let currentImageKey = null;
let isPageVisible = true;

const saved = localStorage.getItem("analytics");
if (saved) {
    analytics = JSON.parse(saved);
}

/* ---------- PRELOAD CHUNK ---------- */
function preloadChunk(start) {
    const end = Math.min(start + CHUNK_SIZE, slides.length);

    for (let i = start; i < end; i++) {
        const img = new Image();
        img.src = slides[i].src;
    }

    loadedUntil = end;
}

/* ---------- LOAD IMAGE ---------- */
// function loadImage(index) {
//     const imgElement = document.getElementById("mainImage");
//     const caption = document.getElementById("caption");

//     if (!slides[index]) return;

//     const slide = slides[index];

//     imgElement.style.opacity = 0;

//     const testImage = new Image();
//     testImage.src = slide.src;

//     testImage.onload = () => {
//         imgElement.src = slide.src;
//         imgElement.style.opacity = 1;
//     };

//     testImage.onerror = () => {
//         console.log("Missing image:", slide.src);
//         nextImage(); // skip missing
//     };

//     if (slide.text.trim() === "") {
//         caption.classList.add("hidden");
//     } else {
//         caption.textContent = slide.text;
//         caption.classList.remove("hidden");
//     }

//     checkPreload(index);
// }

function loadImage(index) {
    const imgElement = document.getElementById("mainImage");
    const caption = document.getElementById("caption");

    if (!slides[index]) return;

    const slide = slides[index];

    // Fade out first
    imgElement.classList.add("fade-out");
    caption.classList.add("caption-fade-out");

    setTimeout(() => {

        const testImage = new Image();
        testImage.src = slide.src;

        testImage.onload = () => {
            imgElement.src = slide.src;

            imgElement.classList.remove("fade-out");
            caption.classList.remove("caption-fade-out");
            startTracking(slide.src);
        };

        testImage.onerror = () => {
            console.log("Missing image:", slide.src);
            nextImage();
        };

        // Caption handling
        if (slide.text.trim() === "") {
            caption.classList.add("hidden");
        } else {
            caption.textContent = slide.text;
            caption.classList.remove("hidden");
        }

    }, 300); // small delay before swap

    checkPreload(index);
}
/* ---------- SMART PRELOAD ---------- */
function checkPreload(index) {
    if (index + 2 >= loadedUntil && loadedUntil < slides.length) {
        preloadChunk(loadedUntil);
    }
}

/* ---------- NAVIGATION ---------- */
function nextImage() {
    if (currentIndex < slides.length - 1) {
        stopTracking();
        currentIndex++;
        loadImage(currentIndex);
    }
}

function prevImage() {
    if (currentIndex > 0) {
        stopTracking();
        currentIndex--;
        loadImage(currentIndex);
    }
}
document.getElementById("next").onclick = nextImage;
document.getElementById("prev").onclick = prevImage;

/* ---------- KEYBOARD SUPPORT ---------- */
document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") nextImage();
    if (e.key === "ArrowLeft") prevImage();
});

/* ---------- INIT ---------- */
preloadChunk(0);
loadImage(currentIndex);



/* ---------- START TRACKING ---------- */
function startTracking(imageSrc) {

    // Stop previous tracking first
    stopTracking();

    currentImageKey = imageSrc;

    if (!analytics[currentImageKey]) {
        analytics[currentImageKey] = {
            time: 0,
            revisits: 0
        };
    }

    analytics[currentImageKey].revisits += 1;

    startTime = Date.now();
}

/* ---------- STOP TRACKING ---------- */
function stopTracking() {

    if (!currentImageKey || !startTime || !isPageVisible) return;

    const duration = Date.now() - startTime;

    analytics[currentImageKey].time += duration;
    localStorage.setItem("analytics", JSON.stringify(analytics));

    startTime = null;
}


/* ---------- VISIBILITY TRACKING ---------- */
document.addEventListener("visibilitychange", () => {

    if (document.hidden) {
        isPageVisible = false;
        stopTracking();
    } else {
        isPageVisible = true;
        if (currentImageKey) {
            startTime = Date.now();
        }
    }
});


window.addEventListener("beforeunload", () => {
    stopTracking();
    console.log("Final Analytics:", analytics);
});

// setInterval(() => {
//     console.clear();
//     console.log("Live Analytics:", analytics);
// }, 2000);





function sendAnalytics() {

    stopTracking();

    const formattedData = {};

    for (const key in analytics) {
        formattedData[key] = {
            time: Math.round(analytics[key].time / 1000), // seconds
            revisits: analytics[key].revisits
        };
    }

    fetch("/api/track", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            sessionId,
            data: formattedData
        })
    }).catch(err => console.error("Send failed:", err));
}

/* ---------- AUTO SEND EVERY 30 SECONDS ---------- */
setInterval(() => {
    if (Object.keys(analytics).length > 0) {
        sendAnalytics();
    }
}, 30000);

/* ---------- SEND WHEN USER LEAVES ---------- */
window.addEventListener("beforeunload", () => {
    sendAnalytics();
});