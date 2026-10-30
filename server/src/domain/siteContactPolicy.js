export function publicContactError(contact={}) {
 const email=String(contact.contactEmail||'').trim();
 if(email&&(email.length>180||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))return 'Enter a valid public contact email address.';
 for(const field of ['phone','whatsapp']){
  const value=String(contact[field]||'').trim();
  if(value&&(value.length>40||!/^[+()\d\s.-]+$/.test(value)))return 'Telephone and WhatsApp details must contain only numbers and standard phone formatting.';
 }
 for(const field of ['physicalAddress','postalAddress'])if(String(contact[field]||'').length>500)return 'Contact addresses must be 500 characters or fewer.';
 if(String(contact.officeHours||'').length>160)return 'Office hours must be 160 characters or fewer.';
 return null;
}
