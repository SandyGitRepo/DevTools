/**
 * FR-U9 synthetic Indian test data with @faker-js/faker (MIT, en_IN locale). Every record carries
 * `test_record: true`, emails use the reserved .test domain and IFSC codes use the non-existent
 * bank code "TEST" so generated data is recognisably fake.
 */
export type FieldId =
  'id' | 'name' | 'gender' | 'dob' | 'email' | 'mobile' | 'pan' | 'address' | 'city' | 'state' | 'pin' | 'company' | 'account' | 'ifsc' | 'amount' | 'date';

export const fieldLabels: Record<FieldId, string> = {
  id: 'UUID',
  name: 'Full name',
  gender: 'Gender',
  dob: 'Date of birth',
  email: 'Email (.test)',
  mobile: 'Mobile (+91)',
  pan: 'PAN-format string',
  address: 'Street address',
  city: 'City',
  state: 'State',
  pin: 'PIN code',
  company: 'Company',
  account: 'Account number',
  ifsc: 'IFSC (TEST bank)',
  amount: 'Amount (INR)',
  date: 'Transaction date',
};

export const defaultFields: FieldId[] = ['id', 'name', 'email', 'mobile', 'pan', 'city', 'state', 'pin'];

type Faker = typeof import('@faker-js/faker').faker;

const iso = (d: Date) => d.toISOString().slice(0, 10);

function record(f: Faker, fields: FieldId[]): Record<string, unknown> {
  const sex = f.helpers.arrayElement(['female', 'male'] as const);
  const first = f.person.firstName(sex);
  const last = f.person.lastName();
  const r: Record<string, unknown> = {};
  for (const id of fields) {
    switch (id) {
      case 'id':
        r.id = f.string.uuid();
        break;
      case 'name':
        r.name = `${first} ${last}`;
        break;
      case 'gender':
        r.gender = sex === 'female' ? 'F' : 'M';
        break;
      case 'dob':
        r.dob = iso(f.date.birthdate({ min: 18, max: 75, mode: 'age' }));
        break;
      case 'email':
        r.email = `${first}.${last}${f.number.int({ min: 1, max: 999 })}`.toLowerCase().replace(/[^a-z0-9.]/g, '') + '@example.test';
        break;
      case 'mobile':
        r.mobile = `+91 ${f.helpers.arrayElement(['6', '7', '8', '9'])}${f.string.numeric(4)} ${f.string.numeric(5)}`;
        break;
      case 'pan':
        // Format only: AAA + holder type P + first letter of surname + 4 digits + letter
        r.pan = `${f.string.alpha({ length: 3, casing: 'upper' })}P${(last[0] ?? 'X').toUpperCase()}${f.string.numeric(4)}${f.string.alpha({ length: 1, casing: 'upper' })}`;
        break;
      case 'address':
        r.address = f.location.streetAddress();
        break;
      case 'city':
        r.city = f.location.city();
        break;
      case 'state':
        r.state = f.location.state();
        break;
      case 'pin':
        r.pin = `${f.number.int({ min: 1, max: 8 })}${f.string.numeric(5)}`;
        break;
      case 'company':
        r.company = f.company.name();
        break;
      case 'account':
        r.account = f.string.numeric({ length: f.number.int({ min: 11, max: 16 }), allowLeadingZeros: false });
        break;
      case 'ifsc':
        r.ifsc = `TEST0${f.string.alphanumeric({ length: 6, casing: 'upper' })}`;
        break;
      case 'amount':
        r.amount = f.number.float({ min: 100, max: 2_500_000, fractionDigits: 2 });
        break;
      case 'date':
        r.date = iso(f.date.recent({ days: 365 }));
        break;
    }
  }
  r.test_record = true;
  return r;
}

export async function generateTestData(count: number, fields: FieldId[], seed?: number): Promise<Record<string, unknown>[]> {
  if (!Number.isInteger(count) || count < 1 || count > 10000) throw new Error('Generate between 1 and 10,000 records');
  if (!fields.length) throw new Error('Choose at least one field');
  const { faker } = await import('@faker-js/faker/locale/en_IN');
  if (seed !== undefined) faker.seed(seed);
  else faker.seed();
  return Array.from({ length: count }, () => record(faker as Faker, fields));
}
