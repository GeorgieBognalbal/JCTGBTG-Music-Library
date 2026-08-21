const API_URL = "https://jctgbtg-music-library.onrender.com";

let songs = [];
let editingId = null;
let selectedId = null;
let newestFirst = true;

const $ = id => document.getElementById(id);

const songList = $("songList");
const emptyState = $("emptyState");
const searchInput = $("searchInput");
const editorModal = $("editorModal");
const viewModal = $("viewModal");
const form = $("songForm");

function setStatus(message) {
  const status = $("status");
  status.textContent = message;
  status.classList.remove("hidden");

  clearTimeout(setStatus.timer);
  setStatus.timer = setTimeout(() => status.classList.add("hidden"), 3500);
}

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

  return response.status === 204 ? null : response.json();
}

async function loadSongs() {
  try {
    songs = await api("/songs");
    renderSongs();
  } catch (error) {
    setStatus(`Could not connect to API: ${error.message}`);
    renderSongs();
  }
}

function renderSongs() {
  const query = searchInput.value.trim().toLowerCase();

  let visible = songs.filter(song =>
    song.title.toLowerCase().includes(query) ||
    (song.artist || "").toLowerCase().includes(query) ||
    song.lyrics.toLowerCase().includes(query)
  );

  visible.sort((a, b) =>
    newestFirst
      ? new Date(b.created_at) - new Date(a.created_at)
      : a.title.localeCompare(b.title)
  );

  $("count").textContent = visible.length;
  songList.innerHTML = "";

  visible.forEach(song => {
    const button = document.createElement("button");
    button.className = "song-card";

    const symbol = document.createElement("div");
    symbol.className = "song-symbol";
    symbol.textContent = "♪";

    const info = document.createElement("div");
    info.className = "song-info";

    const title = document.createElement("h3");
    title.textContent = song.title;

    const artist = document.createElement("p");
    artist.textContent = song.artist || "Unknown artist";

    info.append(title, artist);

    const arrow = document.createElement("span");
    arrow.className = "arrow";
    arrow.textContent = "›";

    button.append(symbol, info, arrow);
    button.addEventListener("click", () => openSong(song.id));
    songList.appendChild(button);
  });

  emptyState.classList.toggle("hidden", visible.length !== 0);
}

async function openSong(id) {
  try {
    const song = await api(`/songs/${id}`);
    selectedId = id;

    $("viewTitle").textContent = song.title;
    $("viewArtist").textContent = song.artist || "Unknown artist";
    $("viewLyrics").textContent = song.lyrics;

    viewModal.classList.remove("hidden");
  } catch (error) {
    setStatus(error.message);
  }
}

function closeModals() {
  editorModal.classList.add("hidden");
  viewModal.classList.add("hidden");
}

async function openEditor(id = null) {
  editingId = id;

  if (id) {
    try {
      const song = await api(`/songs/${id}`);

      $("editorEyebrow").textContent = "EDIT SONG";
      $("editorTitle").textContent = "Edit Song";
      $("titleInput").value = song.title;
      $("artistInput").value = song.artist || "";
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
  $("titleInput").focus();
}

async function saveSong(event) {
  event.preventDefault();

  const payload = {
    title: $("titleInput").value.trim().toUpperCase(),
    artist: $("artistInput").value.trim() || "Unknown artist",
    lyrics: $("lyricsInput").value.trim()
  };

  try {
    $("saveBtn").disabled = true;
    $("saveBtn").textContent = "Saving...";

    if (editingId) {
      await api(`/songs/${editingId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      setStatus("Song updated.");
    } else {
      await api("/songs", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setStatus("Song added.");
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
  const song = songs.find(item => item.id === selectedId);
  if (!song) return;

  if (!confirm(`Delete "${song.title}"?`)) return;

  try {
    await api(`/songs/${selectedId}`, { method: "DELETE" });
    closeModals();
    setStatus("Song deleted.");
    await loadSongs();
  } catch (error) {
    setStatus(error.message);
  }
}

$("addBtn").addEventListener("click", () => openEditor());
$("closeEditor").addEventListener("click", closeModals);
$("cancelBtn").addEventListener("click", closeModals);
$("closeView").addEventListener("click", closeModals);
$("editBtn").addEventListener("click", () => openEditor(selectedId));
$("deleteBtn").addEventListener("click", deleteSong);
form.addEventListener("submit", saveSong);
searchInput.addEventListener("input", renderSongs);

$("sortBtn").addEventListener("click", () => {
  newestFirst = !newestFirst;
  $("sortBtn").textContent = newestFirst ? "Recent ↕" : "A–Z ↕";
  renderSongs();
});

if (localStorage.getItem("church-lyrics-theme") === "dark") {
  document.body.classList.add("dark");
}

loadSongs();
