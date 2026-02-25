// netlify/functions/scrape-psa-images.js
// Fichier temporaire - sera supprimé après

exports.handler = async function(event, context) {
  return {
    statusCode: 410,
    body: JSON.stringify({ 
      error: 'This function has been removed',
      message: 'Image scraping is no longer available'
    })
  };
};