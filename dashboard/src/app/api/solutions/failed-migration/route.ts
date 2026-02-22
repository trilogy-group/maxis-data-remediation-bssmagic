import { NextResponse } from 'next/server';

// API route to find Solutions that failed migration (1147 module)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') || '10';

  try {
    // Query the TMF runtime for Solutions via product API
    // Note: This requires TMF637 product to be mapped in design-time
    const response = await fetch(
      `http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/productInventory/v5/product?limit=${limit}`,
      { 
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      }
    );

    if (!response.ok) {
      // Fallback: If TMF637 not mapped, return sample data structure
      return NextResponse.json({
        message: 'TMF637 Product API not yet mapped. Using SOQL would require direct Salesforce connection.',
        query: `SELECT Id, Name, csord__External_Identifier__c, CreatedBy.Name, CreatedDate 
                FROM csord__Solution__c 
                WHERE CreatedBy.Name = 'Migration User' 
                AND csord__External_Identifier__c = 'Not Migrated Successfully' 
                LIMIT ${limit}`,
        data: [],
        status: 'pending_mapping'
      });
    }

    const products = await response.json();
    
    // Filter for failed migrations (if product API is mapped)
    const failedMigrations = products.filter((p: any) => {
      const characteristics = p.productCharacteristic || [];
      const isMigrated = characteristics.find((c: any) => c.name === 'isMigrated');
      const externalId = characteristics.find((c: any) => c.name === 'externalIdentifier');
      
      return isMigrated?.value === false || 
             externalId?.value === 'Not Migrated Successfully';
    });

    return NextResponse.json({
      data: failedMigrations,
      total: failedMigrations.length,
      query: 'TMF637 Product API - filtered for failed migrations'
    });

  } catch (error) {
    console.error('Error fetching failed migrations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch solutions', details: String(error) },
      { status: 500 }
    );
  }
}











