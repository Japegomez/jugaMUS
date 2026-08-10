import * as Clipboard from 'expo-clipboard'
import * as Contacts from 'expo-contacts'
import { Platform } from 'react-native'

export type OpenCreateContactResult = 'created' | 'cancelled' | 'unsupported' | 'error'

export interface CreateContactInput {
  displayName: string
  phoneE164: string
}

/** Split "Juan García López" → givenName + familyName for the native contact form. */
export function splitDisplayName(name: string): { givenName: string; familyName: string } {
  const trimmed = name.trim()
  if (!trimmed) return { givenName: '', familyName: '' }
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return { givenName: parts[0], familyName: '' }
  return { givenName: parts[0], familyName: parts.slice(1).join(' ') }
}

/**
 * Opens the system "Create contact" form prefilled with the player's name and phone.
 * On web (no contacts API), copies the phone number to the clipboard instead.
 */
export async function openCreateContactForm(
  input: CreateContactInput
): Promise<OpenCreateContactResult> {
  const phone = input.phoneE164.trim()
  const displayName = input.displayName.trim()
  if (!phone) return 'error'

  if (Platform.OS === 'web') {
    try {
      await Clipboard.setStringAsync(phone)
      return 'unsupported'
    } catch {
      return 'error'
    }
  }

  try {
    const { givenName, familyName } = splitDisplayName(displayName || phone)
    // SDK 54 API: presentFormAsync(null, contact, { isNew: true })
    await Contacts.presentFormAsync(
      null,
      {
        contactType: Contacts.ContactTypes.Person,
        name: displayName || givenName,
        firstName: givenName,
        lastName: familyName || undefined,
        phoneNumbers: [
          {
            label: 'mobile',
            number: phone,
            isPrimary: true,
          },
        ],
      },
      { isNew: true }
    )
    // presentFormAsync resolves when the form closes; OS does not report save vs cancel.
    return 'cancelled'
  } catch {
    return 'error'
  }
}
