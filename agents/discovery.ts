import fetch from 'node-fetch';
import { NextApiRequest, NextApiResponse } from 'next';
import { GoogleMapsPlacesApiUrl, AzCorpCommissionApiUrl, GoogleMapsPlacesApiKey, AzCorpCommissionApiKey } from '@/config';

export async function getLeadsFromGoogleMapsPlaces(query: string) {
  try {
    const url = `${GoogleMapsPlacesApiUrl}?key=${GoogleMapsPlacesApiKey}&query=${query}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch data from Google Maps Places API: ${response.statusText}`);
    }
    const data = await response.json();
    return data.results;
  } catch (error) {
    console.error('Error fetching leads from Google Maps Places API:', error);
    throw error;
  }
}

export async function getLeadsFromAzCorpCommission(query: string) {
  try {
    const url = `${AzCorpCommissionApiUrl}?key=${AzCorpCommissionApiKey}&query=${query}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch data from AZ Corp Commission API: ${response.statusText}`);
    }
    const data = await response.json();
    return data.results;
  } catch (error) {
    console.error('Error fetching leads from AZ Corp Commission API:', error);
    throw error;
  }
}

export async function discoverLeads(query: string) {
  try {
    const googleMapsPlacesLeads = await getLeadsFromGoogleMapsPlaces(query);
    const azCorpCommissionLeads = await getLeadsFromAzCorpCommission(query);
    return [...googleMapsPlacesLeads, ...azCorpCommissionLeads];
  } catch (error) {
    console.error('Error discovering leads:', error);
    throw error;
  }
}