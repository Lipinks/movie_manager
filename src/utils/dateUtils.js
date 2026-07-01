export const formatDate = (dateString) => {
  if (!dateString) return "No date available";
  
  const date = new Date(dateString);
  return isNaN(date) ? "Invalid date" : date.toLocaleString();
};