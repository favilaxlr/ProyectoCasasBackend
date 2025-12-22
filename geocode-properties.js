import Property from './src/models/property.models.js';
import { connectDB } from './src/db.js';

/**
 * Script para geocodificar todas las propiedades sin coordenadas
 * Uso: node geocode-properties.js
 */

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

const geocodeAddress = async (address) => {
  const query = `${address.street}, ${address.city}, ${address.state}, ${address.zipCode}`;
  
  try {
    const response = await fetch(
      `${NOMINATIM_BASE_URL}/search?` + 
      new URLSearchParams({
        q: query,
        format: 'json',
        limit: '1',
        addressdetails: '1'
      }),
      {
        headers: {
          'User-Agent': 'FRFamilyInvestments/1.0'
        }
      }
    );
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error geocoding:', error);
    return null;
  }
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function geocodeAllProperties() {
  try {
    // Conectar a la base de datos
    await connectDB();
    console.log('✅ Conectado a MongoDB');
    
    // Buscar propiedades sin coordenadas
    const properties = await Property.find({
      $or: [
        { 'address.coordinates': { $exists: false } },
        { 'address.coordinates.lat': { $exists: false } },
        { 'address.coordinates.lng': { $exists: false } }
      ]
    });
    
    console.log(`📍 Encontradas ${properties.length} propiedades sin coordenadas`);
    
    if (properties.length === 0) {
      console.log('🎉 Todas las propiedades ya tienen coordenadas!');
      process.exit(0);
    }
    
    let success = 0;
    let failed = 0;
    
    for (const property of properties) {
      console.log(`\n🔍 Geocodificando: ${property.title}`);
      console.log(`   Dirección: ${property.address.street}, ${property.address.city}`);
      
      const coords = await geocodeAddress(property.address);
      
      if (coords) {
        property.address.coordinates = coords;
        await property.save();
        console.log(`    Éxito: ${coords.lat}, ${coords.lng}`);
        success++;
      } else {
        console.log(`    No se pudo geocodificar`);
        failed++;
      }
      
      // Respetar límite de 1 solicitud por segundo de Nominatim
      if (properties.indexOf(property) < properties.length - 1) {
        console.log('   ⏳ Esperando 1 segundo...');
        await sleep(1000);
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(` Geocodificación completa!`);
    console.log(`    Exitosas: ${success}`);
    console.log(`    Fallidas: ${failed}`);
    console.log(`    Total: ${properties.length}`);
    console.log('='.repeat(50) + '\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Ejecutar script
geocodeAllProperties();
