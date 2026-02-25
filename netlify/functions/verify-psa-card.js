// netlify/functions/verify-psa-card.js

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    let { certNumber } = JSON.parse(event.body);

    if (!certNumber) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Certification number is required' })
      };
    }

    // Remove # if present
    certNumber = certNumber.replace(/^#+/, '');

    const PSA_TOKEN = process.env.PSA_API_TOKEN;

    if (!PSA_TOKEN) {
      console.error('PSA_API_TOKEN not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'PSA API not configured'
        })
      };
    }

    console.log('Calling PSA API for cert:', certNumber);

    // STEP 1: Get card details
    const psaResponse = await fetch(
      `https://api.psacard.com/publicapi/cert/GetByCertNumber/${certNumber}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${PSA_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('PSA API response status:', psaResponse.status);

    if (!psaResponse.ok) {
      if (psaResponse.status === 404) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ 
            error: 'Certificate not found',
            message: 'No card found with this certification number'
          })
        };
      }

      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ 
          error: 'PSA API error',
          message: `PSA API returned status ${psaResponse.status}`
        })
      };
    }

    const psaData = await psaResponse.json();
    console.log('PSA data received successfully');
    
    const cert = psaData.PSACert || psaData.Cert || psaData;
    
    const getField = (obj, ...possibleKeys) => {
      for (const key of possibleKeys) {
        if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
          return obj[key];
        }
      }
      return null;
    };

    // STEP 2: Get images using the GetImagesByCertNumber endpoint
    let frontImageUrl = null;
    let backImageUrl = null;
    let labelImageUrl = null;

    console.log('Fetching images from PSA API...');
    
    try {
      const imagesResponse = await fetch(
        `https://api.psacard.com/publicapi/cert/GetImagesByCertNumber/${certNumber}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${PSA_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Images API response status:', imagesResponse.status);

      if (imagesResponse.ok) {
        const imagesData = await imagesResponse.json();
        console.log('Images data received:', JSON.stringify(imagesData));

        // L'API retourne un array avec IsFrontImage et ImageURL
        if (Array.isArray(imagesData)) {
          for (const image of imagesData) {
            if (image.IsFrontImage === true && image.ImageURL) {
              frontImageUrl = image.ImageURL;
              console.log('✅ Found front image:', frontImageUrl);
            } else if (image.IsFrontImage === false && image.ImageURL) {
              backImageUrl = image.ImageURL;
              console.log('✅ Found back image:', backImageUrl);
            }
          }
        }

        console.log('📊 Final images:');
        console.log('  - Front:', frontImageUrl || 'NOT FOUND');
        console.log('  - Back:', backImageUrl || 'NOT FOUND');
      } else {
        console.log('⚠️ Images endpoint returned status:', imagesResponse.status);
        console.log('Images may not be available for this card');
      }
    } catch (imageError) {
      console.error('Error fetching images:', imageError.message);
      // Continue without images - not critical
    }

    const cardData = {
      certNumber: getField(cert, 'CertNumber', 'CertNo') || certNumber,
      cardName: getField(cert, 'CardTitle', 'Title', 'Subject', 'Name') || 'Unknown Card',
      grade: getField(cert, 'CardGrade', 'Grade', 'GradeDescription') || 'N/A',
      variety: getField(cert, 'Variety', 'Type') || '',
      year: getField(cert, 'Year') || '',
      brand: getField(cert, 'Brand') || '',
      category: getField(cert, 'Category') || '',
      sport: getField(cert, 'Sport') || '',
      subject: getField(cert, 'Subject') || '',
      specNotes: getField(cert, 'SpecNotes', 'Notes') || '',
      totalPopulation: parseInt(getField(cert, 'TotalPopulation', 'TotalPop') || '0'),
      popHigherGrade: parseInt(getField(cert, 'PopHigherGrade', 'PopulationHigher') || '0'),
      frontImageUrl: frontImageUrl,
      backImageUrl: backImageUrl,
      labelImageUrl: labelImageUrl,
      certDate: getField(cert, 'CertDate'),
      gradeReasoning: getField(cert, 'GradeReasoning'),
      specId: getField(cert, 'SpecID', 'SpecNumber', 'Spec')
    };

    console.log('✅ Final card data:');
    console.log('  - Card name:', cardData.cardName);
    console.log('  - Grade:', cardData.grade);
    console.log('  - Front image:', cardData.frontImageUrl || 'NOT FOUND');
    console.log('  - Back image:', cardData.backImageUrl || 'NOT FOUND');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        card: cardData
      })
    };

  } catch (error) {
    console.error('Error in verify-psa-card function:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: 'Failed to verify PSA certification',
        details: error.message
      })
    };
  }
};