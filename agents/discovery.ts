import { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';
import { AZ_CORP_COMMISSION_API, GOOGLE_MAPS_PLACES_API } from '@/config';

export async function getLeadsFromGoogleMapsPlaces(
  query: string,
  location: string,
  radius: number
): Promise<any[]> {
  try {
    const url = `${GOOGLE_MAPS_PLACES_API}?query=${query}&location=${location}&radius=${radius}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    return data.results;
  } catch (error) {
    console.error('Error fetching leads from Google Maps Places:', error);
    return [];
  }
}

export async function getLeadsFromAZCorpCommission(
  query: string
): Promise<any[]> {
  try {
    const url = `${AZ_CORP_COMMISSION_API}?query=${query}`;
    const response = await fetch(url);
    const data = await response.json();
    return data.results;
  } catch (error) {
    console.error('Error fetching leads from AZ Corp Commission:', error);
    return [];
  }
}

export async function discoverLeads(
  query: string,
  location: string,
  radius: number
): Promise<any[]> {
  try {
    const googleMapsLeads = await getLeadsFromGoogleMapsPlaces(
      query,
      location,
      radius
    );
    const azCorpCommissionLeads = await getLeadsFromAZCorpCommission(query);
    return [...googleMapsLeads, ...azCorpCommissionLeads];
  } catch (error) {
    console.error('Error discovering leads:', error);
    return [];
  }
}