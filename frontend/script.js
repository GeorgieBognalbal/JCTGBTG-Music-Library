const API_URL = "https://jctgbtg-music-library.onrender.com";

let songs = [];
let editingId = null;
let selectedId = null;
let newestFirst = true;

let lyricsFontSize =
    Number(localStorage.getItem("jctgbtg-lyrics-size")) || 18;

let favorites = JSON.parse(
    localStorage.getItem("jctgbtg-favorites") || "[]"
);

const $ = (id) => document.getElementById(id);

const songList = $("songList");
const emptyState = $("emptyState");
const searchInput = $("searchInput");
const editorModal = $("editorModal");
const viewModal = $("viewModal");
const form = $("songForm");
const loadingState = $("loadingState");

/* =========================
   STATUS
========================= */

function setStatus(message) {
    const status = $("status");

    status.textContent = message;
    status.classList.remove("hidden");

    clearTimeout(setStatus.timer);

    setStatus.timer = setTimeout(() => {
        status.classList.add("hidden");
    }, 3500);
}

/* =========================
   API
========================= */

async function api(path = "", options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        },
        ...options
    });

    if (!response.ok) {
        let message = "Request failed";

        try {
            const data = await response.json();
            message = data.detail || message;
        } catch {}

        throw new Error(message);
    }

    return response.status === 204
        ? null
        : response.json();
}

/* =========================
   FAVORITES
========================= */

function isFavorite(id) {
    return favorites.includes(id);
}

function saveFavorites() {
    localStorage.setItem(
        "jctgbtg-favorites",
        JSON.stringify(favorites)
    );
}

function toggleFavorite(id) {
    favorites = isFavorite(id)
        ? favorites.filter((item) => item !== id)
        : [...favorites, id];

    saveFavorites();
    renderSongs();
    updateFavoriteButton();
}

function updateFavoriteButton() {
    const active = isFavorite(selectedId);

    $("favoriteBtn").textContent = active
        ? "♥ Favorited"
        : "♡ Favorite";

    $("viewFavoriteLabel").textContent = active
        ? "Saved to favorites"
        : "Not favorited";
}

/* =========================
   LOAD SONGS
========================= */

async function loadSongs() {
    loadingState.classList.remove("hidden");

    songList.innerHTML = "";
    emptyState.classList.add("hidden");

    try {
        songs = await api("/songs");
        renderSongs();
    } catch (error) {
        setStatus(`Could not connect to API: ${error.message}`);

        songs = [];
        renderSongs();
    } finally {
        loadingState.classList.add("hidden");
    }
}

/* =========================
   RENDER SONGS
========================= */

function renderSongs() {
    const query = searchInput.value
        .trim()
        .toLowerCase();

    $("clearSearch").classList.toggle(
        "hidden",
        !query
    );

    let visible = songs.filter(
        (song) =>
            song.title.toLowerCase().includes(query) ||
            (song.artist || "")
                .toLowerCase()
                .includes(query) ||
            song.lyrics.toLowerCase().includes(query)
    );

    visible.sort((a, b) => {
        if (newestFirst) {
            return (
                new Date(b.created_at) -
                new Date(a.created_at)
            );
        }

        return a.title.localeCompare(b.title);
    });

    $("count").textContent = visible.length;
    $("totalCount").textContent = songs.length;

    songList.innerHTML = "";

    visible.forEach((song) => {
        const button = document.createElement("button");

        button.className = "song-card";
        button.type = "button";

        const symbol = document.createElement("div");

        symbol.className = "song-symbol";
        symbol.textContent = "♪";

        const info = document.createElement("div");

        info.className = "song-info";

        const title = document.createElement("h3");

        title.textContent = song.title;

        if (isFavorite(song.id)) {
            const heart = document.createElement("span");

            heart.className = "favorite-mark";
            heart.textContent = "♥";

            title.append(" ", heart);
        }

        const artist = document.createElement("p");

        artist.textContent =
            song.artist || "Unknown artist";

        info.append(title, artist);

        const arrow = document.createElement("span");

        arrow.className = "song-arrow";
        arrow.textContent = "›";

        button.append(
            symbol,
            info,
            arrow
        );

        button.addEventListener("click", () => {
            openSong(song.id);
        });

        songList.appendChild(button);
    });

    const noResults = visible.length === 0;

    emptyState.classList.toggle(
        "hidden",
        !noResults
    );

    $("emptyMessage").textContent = query
        ? `Nothing matched “${searchInput.value.trim()}”. Try another search.`
        : "Your library is ready for its first song.";
}

/* =========================
   OPEN SONG
========================= */

async function openSong(id) {
    try {
        const song = await api(`/songs/${id}`);

        selectedId = id;

        $("viewTitle").textContent = song.title;

        $("viewArtist").textContent =
            song.artist || "Unknown artist";

        $("viewLyrics").textContent = song.lyrics;

        applyLyricsSize();
        updateFavoriteButton();

        viewModal.classList.remove("hidden");

        document.body.classList.add("modal-open");
    } catch (error) {
        setStatus(error.message);
    }
}

/* =========================
   CLOSE MODALS
========================= */

function closeModals() {
    editorModal.classList.add("hidden");
    viewModal.classList.add("hidden");

    $("viewModal")
        .querySelector(".lyrics-card")
        .classList.remove("fullscreen-lyrics");

    document.body.classList.remove("modal-open");
}

/* =========================
   OPEN EDITOR
========================= */

async function openEditor(id = null) {
    editingId = id;

    if (id) {
        try {
            const song = await api(`/songs/${id}`);

            $("editorEyebrow").textContent = "EDIT SONG";
            $("editorTitle").textContent = "Edit Song";

            $("titleInput").value = song.title;

            $("artistInput").value =
                song.artist === "Unknown artist"
                    ? ""
                    : song.artist || "";

            $("lyricsInput").value = song.lyrics;
        } catch (error) {
            setStatus(error.message);
            return;
        }
    } else {
        $("editorEyebrow").textContent = "NEW SONG";
        $("editorTitle").textContent = "Add Song";

        form.reset();
    }

    viewModal.classList.add("hidden");
    editorModal.classList.remove("hidden");

    document.body.classList.add("modal-open");

    setTimeout(() => {
        $("titleInput").focus();
    }, 50);
}

async function saveSong(event) {
    event.preventDefault();

    const payload = {
        title: $("titleInput")
            .value
            .trim()
            .toUpperCase(),

        artist:
            $("artistInput").value.trim() ||
            "Unknown artist",

        lyrics:
            $("lyricsInput").value.trim()
    };

    try {
        $("saveBtn").disabled = true;

        $("saveBtn").textContent =
            editingId
                ? "Updating..."
                : "Saving...";

        if (editingId) {
            await api(`/songs/${editingId}`, {
                method: "PUT",
                body: JSON.stringify(payload)
            });

            setStatus("Song updated successfully.");
        } else {
            await api("/songs", {
                method: "POST",
                body: JSON.stringify(payload)
            });

            setStatus("Song added to the library.");
        }

        closeModals();

        await loadSongs();
    } catch (error) {
        setStatus(error.message);
    } finally {
        $("saveBtn").disabled = false;
        $("saveBtn").textContent = "Save Song";
    }
}

async function deleteSong() {
    const song = songs.find(
        (item) => item.id === selectedId
    );

    if (!song) return;

    if (
        !confirm(
            `Delete “${song.title}”? This cannot be undone.`
        )
    ) {
        return;
    }

    try {
        await api(`/songs/${selectedId}`, {
            method: "DELETE"
        });

        favorites = favorites.filter(
            (id) => id !== selectedId
        );

        saveFavorites();

        closeModals();

        setStatus("Song deleted.");

        await loadSongs();
    } catch (error) {
        setStatus(error.message);
    }
}

async function copyLyrics() {
    const song = songs.find(
        (item) => item.id === selectedId
    );

    if (!song) return;

    try {
        await navigator.clipboard.writeText(
            `${song.title}\n\n${song.lyrics}`
        );

        setStatus("Lyrics copied to clipboard.");
    } catch {
        setStatus(
            "Could not copy lyrics on this device."
        );
    }
}


async function shareSong() {
    const song = songs.find(
        (item) => item.id === selectedId
    );

    if (!song) return;

    const shareData = {
        title: song.title,
        text: `${song.title}\n\n${song.lyrics}`,
        url: location.href
    };

    if (navigator.share) {
        try {
            await navigator.share(shareData);
        } catch {}
    } else {
        await copyLyrics();
    }
}


function applyLyricsSize() {
    $("viewLyrics").style.fontSize =
        `${lyricsFontSize}px`;

    localStorage.setItem(
        "jctgbtg-lyrics-size",
        lyricsFontSize
    );
}

function changeLyricsSize(delta) {
    lyricsFontSize = Math.min(
        30,
        Math.max(
            14,
            lyricsFontSize + delta
        )
    );

    applyLyricsSize();
}

function toggleTheme() {
    document.body.classList.toggle("dark");

    const dark =
        document.body.classList.contains("dark");

    localStorage.setItem(
        "jctgbtg-theme",
        dark ? "dark" : "light"
    );

    $("themeBtn").textContent =
        dark ? "☀" : "☾";

    document
        .querySelector('meta[name="theme-color"]')
        .setAttribute(
            "content",
            dark ? "#0c0b12" : "#f6f3ee"
        );
}

function closeOnBackdrop(event) {
    if (
        event.target === editorModal ||
        event.target === viewModal
    ) {
        closeModals();
    }
}

$("addBtn").addEventListener(
    "click",
    () => openEditor()
);

$("heroAddBtn").addEventListener(
    "click",
    () => openEditor()
);

$("emptyAddBtn").addEventListener(
    "click",
    () => openEditor()
);

$("focusSearchBtn").addEventListener(
    "click",
    () => {
        searchInput.focus();

        searchInput.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }
);

$("themeBtn").addEventListener(
    "click",
    toggleTheme
);

$("closeEditor").addEventListener(
    "click",
    closeModals
);

$("cancelBtn").addEventListener(
    "click",
    closeModals
);

$("closeView").addEventListener(
    "click",
    closeModals
);

$("editBtn").addEventListener(
    "click",
    () => openEditor(selectedId)
);

$("deleteBtn").addEventListener(
    "click",
    deleteSong
);

$("favoriteBtn").addEventListener(
    "click",
    () => toggleFavorite(selectedId)
);

$("copyBtn").addEventListener(
    "click",
    copyLyrics
);

$("shareBtn").addEventListener(
    "click",
    shareSong
);

$("fontDownBtn").addEventListener(
    "click",
    () => changeLyricsSize(-1)
);

$("fontUpBtn").addEventListener(
    "click",
    () => changeLyricsSize(1)
);

$("fullscreenBtn").addEventListener(
    "click",
    () => {
        $("viewModal")
            .querySelector(".lyrics-card")
            .classList.toggle(
                "fullscreen-lyrics"
            );
    }
);

form.addEventListener(
    "submit",
    saveSong
);

searchInput.addEventListener(
    "input",
    renderSongs
);

$("clearSearch").addEventListener(
    "click",
    () => {
        searchInput.value = "";
        searchInput.focus();
        renderSongs();
    }
);

$("sortBtn").addEventListener(
    "click",
    () => {
        newestFirst = !newestFirst;

        $("sortBtn").innerHTML =
            newestFirst
                ? "Recent <span>↕</span>"
                : "A–Z <span>↕</span>";

        renderSongs();
    }
);

editorModal.addEventListener(
    "click",
    closeOnBackdrop
);

viewModal.addEventListener(
    "click",
    closeOnBackdrop
);

//Shortcut

document.addEventListener(
    "keydown",
    (event) => {
        if (event.key === "Escape") {
            closeModals();
        }

        if (
            event.key === "/" &&
            document.activeElement !== searchInput &&
            document.activeElement.tagName !== "INPUT" &&
            document.activeElement.tagName !== "TEXTAREA"
        ) {
            event.preventDefault();
            searchInput.focus();
        }
    }
);

if (
    localStorage.getItem("jctgbtg-theme") === "dark"
) {
    document.body.classList.add("dark");

    $("themeBtn").textContent = "☀";

    document
        .querySelector('meta[name="theme-color"]')
        .setAttribute(
            "content",
            "#0c0b12"
        );
}

loadSongs();