import fetch from 'node-fetch';
import { NextApiRequest, NextApiResponse } from 'next';
import { GoogleMapsPlacesApiUrl, AzCorpCommissionApiUrl, GoogleMapsPlacesApiKey, AzCorpCommissionApiKey } from '@/config';

export async function getGoogleMapsPlaces(terms: string, location: string, radius: number): Promise<any> {
  try {
    const url = `${GoogleMapsPlacesApiUrl}?key=${GoogleMapsPlacesApiKey}&query=${terms}&location=${location}&radius=${radius}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching Google Maps Places:', error);
    throw error;
  }
}

export async function getAzCorpCommission(data: any): Promise<any> {
  try {
    const url = `${AzCorpCommissionApiUrl}?key=${AzCorpCommissionApiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error fetching AZ Corp Commission:', error);
    throw error;
  }
}

export async function discoverLeads(terms: string, location: string, radius: number): Promise<any> {
  try {
    const googleMapsPlaces = await getGoogleMapsPlaces(terms, location, radius);
    const leads = googleMapsPlaces.results.map((place: any) => {
      return {
        name: place.name,
        address: place.vicinity,
      };
    });
    const azCorpCommissionData = leads.map((lead: any) => {
      return {
        name: lead.name,
        address: lead.address,
      };
    });
    const azCorpCommissionResults = await getAzCorpCommission(azCorpCommissionData);
    return azCorpCommissionResults;
  } catch (error) {
    console.error('Error discovering leads:', error);
    throw error;
  }
}