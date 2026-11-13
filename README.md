# Movie Manager

A personal, browser-only media organiser built with React. It tracks stars, the
videos filed under each one, video categories, YouTube embeds, an image gallery
and a list of websites to check for updates. All data lives in the browser's
localStorage and is backed up to your own Google Drive.

Live site: <https://lipinks.github.io/movie_manager>

## Features

- **Stars**: a photo grid of stars that can be shuffled or sorted
  alphabetically. Each star has a page with its videos, an optional database
  link, and an edit dialog.
- **Videos**: every video across all stars, filterable by category and star,
  sortable by creation or modified time, and shuffleable.
- **Categories**: one card per tag, with a cover picked automatically (or
  pinned by hand). Videos can be added to or removed from a category, and a
  category can be deleted without deleting its videos.
- **YouTube**: saved embeds. Paste a watch URL, a `youtu.be` link or an
  `<iframe>` snippet.
- **Gallery**: browse, upload and delete images in a `gallery` folder (and its
  subfolders) in your Google Drive.
- **Updates**: a saved list of websites, with a button to open them all.

## How data is stored

Everything except the Gallery is kept in localStorage. Two header buttons move
it to and from Google Drive:

- **Sync** uploads every document to Drive, overwriting the copies there.
- **Fetch** downloads them and replaces the local copies. A document that does
  not exist on Drive yet leaves its local copy untouched.

The documents are JSON files in your Drive: `star.json`, `favorites.json`,
`tags.json`, `youtube.json`, `categoryThumbnails.json` and `updates.json`.

Sign-in uses Google Identity Services with the full `drive` scope. Access
tokens last about an hour and are renewed silently while your Google session
is alive; if renewal needs you, the app returns to the login screen.

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Optional: to use your own Google OAuth client instead of the default one in
   `src/App.js`, create a `.env.local` file:

   ```
   REACT_APP_GOOGLE_CLIENT_ID=your_client_id_here
   ```

   The OAuth client must list the origin you run on (for example
   `http://localhost:3000`) as an authorised JavaScript origin.

3. Start the dev server, which opens <http://localhost:3000>:

   ```bash
   npm start
   ```

## Scripts

| Command          | What it does                                                    |
| ---------------- | --------------------------------------------------------------- |
| `npm start`      | Dev server with hot reload                                      |
| `npm test`       | Jest tests in watch mode                                        |
| `npm run build`  | Production build into `build/`                                  |
| `npm run deploy` | Builds, then publishes `build/` to the `gh-pages` branch        |

## Project layout

- `src/services/`: data access. Each store has one service, and components never
  read or write localStorage directly.
- `src/utils/`: the localStorage cache, URL validation, and date and name helpers.
- `src/components/`: one folder per page, plus `common/` for shared dialogs and
  controls.
- `src/styles/`: shared theme tokens and modal and card styles.
