import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Direct PostgreSQL API for Shopping Carts
 * Uses docker exec to bypass TMF Server JSONB bug
 * 
 * GET /api/direct/shopping-cart?limit=10&offset=0
 */

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    // SQL query for shopping carts with all fields mapped to TMF standard names
    const sql = `
      SELECT json_agg(cart) FROM (
        SELECT 
          t0."Id" AS id,
          CONCAT('http://localhost:8000/shoppingCart/', t0."Id") AS href,
          t0."Name" AS name,
          t0."cscfga__validation_message__c" AS description,
          t0."cscfga__Basket_Status__c" AS status,
          (t0."CreatedDate")::timestamp(0) with time zone AS "creationDate",
          (t0."LastModifiedDate")::timestamp(0) with time zone AS "lastUpdate",
          jsonb_build_object(
            'startDateTime', (t0."CreatedDate")::timestamp(0) with time zone,
            'endDateTime', (t0."LastModifiedDate")::timestamp(0) with time zone
          ) AS "validFor",
          t0."cscfga__Total_Price__c" AS "totalPrice",
          t0."cscfga__total_contract_value__c" AS "totalContractValue",
          t0."CurrencyIsoCode" AS currency,
          t1."Id" AS "accountId",
          t1."Name" AS "accountName",
          t0."csordtelcoa__Basket_Stage__c" AS "basketStage",
          'ShoppingCart' AS "@type"
        FROM salesforce_server."cscfga__Product_Basket__c" t0
        LEFT JOIN salesforce_server."Account" t1 ON (t1."Id" = t0."csordtelcoa__Account__c")
        ORDER BY t0."LastModifiedDate" DESC
        LIMIT ${limit} OFFSET ${offset}
      ) AS cart;
    `;

    // Execute via docker exec
    const { stdout, stderr } = await execAsync(
      `docker exec bssmagic-runtime psql -U postgres -d bssmagic -t -A -c "${sql.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`,
      { timeout: 30000 }
    );

    if (stderr && !stderr.includes('NOTICE')) {
      console.error('PostgreSQL stderr:', stderr);
    }

    // Parse JSON result
    let carts = [];
    try {
      const result = stdout.trim();
      if (result && result !== '' && result !== 'null') {
        carts = JSON.parse(result) || [];
      }
    } catch (e) {
      console.error('JSON parse error:', e, 'stdout:', stdout);
      return NextResponse.json([]);
    }

    // Fetch cart items for each cart
    const cartsWithItems = await Promise.all(
      carts.map(async (cart: any) => {
        const itemsSql = `
          SELECT json_agg(item) FROM (
            SELECT 
              t0."Id" AS id,
              t0."Name" AS name,
              CASE
                WHEN LOWER(t0."cscfga__Configuration_Status__c") LIKE '%add%' THEN 'add'
                WHEN LOWER(t0."cscfga__Configuration_Status__c") LIKE '%modify%' THEN 'modify'
                WHEN LOWER(t0."cscfga__Configuration_Status__c") LIKE '%delete%' THEN 'delete'
                ELSE 'add'
              END AS action,
              COALESCE(t0."cscfga__Quantity__c"::integer, 1) AS quantity,
              t0."cscfga__Configuration_Status__c" AS status,
              'CartItem' AS "@type",
              t0."cscfga__total_one_off_charge__c" AS "oneOffCharge",
              t0."cscfga__total_recurring_charge__c" AS "recurringCharge",
              t0."cscfga__total_contract_value__c" AS "totalContractValue",
              t0."CurrencyIsoCode" AS currency,
              t0."cscfga__Billing_Frequency__c" AS "billingFrequency",
              t0."cscfga__Contract_Term__c" AS "contractTerm",
              t0."cscfga__Product_Definition__c" AS "productDefinitionId",
              t0."cscfga__Product_Family__c" AS "productFamily",
              t0."csexpimp1__guid__c" AS guid,
              t0."cssdm__solution_association__c" AS "solutionId",
              sol."Name" AS "solutionName",
              t0."cscfga__Parent_Configuration__c" AS "parentConfigurationId",
              (t0."CreatedDate")::timestamp(0) with time zone AS "createdDate",
              (t0."LastModifiedDate")::timestamp(0) with time zone AS "lastModifiedDate"
            FROM salesforce_server."cscfga__Product_Configuration__c" t0
            LEFT JOIN salesforce_server."csord__Solution__c" sol ON sol."Id" = t0."cssdm__solution_association__c"
            WHERE t0."cscfga__Product_Basket__c" = '${cart.id}'
            ORDER BY t0."Name"
          ) AS item;
        `;

        try {
          const { stdout: itemsStdout } = await execAsync(
            `docker exec bssmagic-runtime psql -U postgres -d bssmagic -t -A -c "${itemsSql.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`,
            { timeout: 30000 }
          );

          let items = [];
          const itemsResult = itemsStdout.trim();
          if (itemsResult && itemsResult !== '' && itemsResult !== 'null') {
            items = JSON.parse(itemsResult) || [];
          }

          // Build pricing arrays for each item
          const itemsWithPricing = items.map((item: any) => {
            const itemPrice = [];
            if (item.oneOffCharge && item.oneOffCharge !== 0) {
              itemPrice.push({
                priceType: 'oneOff',
                name: item.name,
                price: { value: item.oneOffCharge, unit: item.currency },
                '@type': 'CartPrice'
              });
            }
            if (item.recurringCharge && item.recurringCharge !== 0) {
              itemPrice.push({
                priceType: 'recurring',
                name: item.name,
                price: { value: item.recurringCharge, unit: item.currency },
                recurringChargePeriod: item.billingFrequency === 1 ? 'monthly' : 
                                      item.billingFrequency === 12 ? 'yearly' : 'monthly',
                '@type': 'CartPrice'
              });
            }
            
            const itemTotalPrice = item.totalContractValue ? [{
              priceType: 'totalContractValue',
              name: item.name,
              price: { value: item.totalContractValue, unit: item.currency },
              '@type': 'CartPrice'
            }] : [];

            return {
              ...item,
              itemPrice,
              itemTotalPrice,
              productOffering: item.productDefinitionId ? {
                id: item.productDefinitionId,
                name: item.name,
                family: item.productFamily
              } : null
            };
          });

          return { ...cart, cartItem: itemsWithPricing };
        } catch (e) {
          console.error('Error fetching items for cart:', cart.id, e);
          return { ...cart, cartItem: [] };
        }
      })
    );

    // Add cartTotalPrice and relatedParty
    const finalCarts = cartsWithItems.map((cart: any) => {
      const cartTotalPrice = cart.totalPrice ? [{
        priceType: 'total',
        name: cart.name,
        price: { value: cart.totalPrice, unit: cart.currency },
        recurringChargePeriod: 'monthly',
        '@type': 'CartPrice'
      }] : [];

      const relatedParty = cart.accountId ? [{
        id: cart.accountId,
        name: cart.accountName,
        role: 'customer',
        '@type': 'RelatedParty'
      }] : [];

      return { ...cart, cartTotalPrice, relatedParty };
    });

    return NextResponse.json(finalCarts);
  } catch (error) {
    console.error('Error fetching shopping carts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shopping carts', details: String(error) },
      { status: 500 }
    );
  }
}

