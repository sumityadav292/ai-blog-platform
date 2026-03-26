function escapeRegExp(str) {
  // Escape regex metacharacters so user input is treated as literal text.
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { escapeRegExp };

