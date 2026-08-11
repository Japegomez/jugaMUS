import { FORM_FIELDS_MISSING_ALERT, showFormFieldsMissingAlert } from '@/utils/formValidation'

jest.mock('@/utils/alert', () => ({
  showAlert: jest.fn(),
}))

import { showAlert } from '@/utils/alert'

describe('formValidation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('exports consistent alert copy', () => {
    expect(FORM_FIELDS_MISSING_ALERT.title).toBe('Campos incompletos')
    expect(FORM_FIELDS_MISSING_ALERT.message).toContain('marcados en rojo')
  })

  it('showFormFieldsMissingAlert delegates to showAlert', () => {
    showFormFieldsMissingAlert()
    expect(showAlert).toHaveBeenCalledWith(
      FORM_FIELDS_MISSING_ALERT.title,
      FORM_FIELDS_MISSING_ALERT.message
    )
  })
})
