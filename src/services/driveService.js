export const listFiles = async (accessToken) => {
  const response = await fetch(
    "https://www.googleapis.com/drive/v3/files?fields=files(id,name,modifiedTime)",
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );
  const data = await response.json();
  return data.files || [];
};