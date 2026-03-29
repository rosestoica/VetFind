---
name: Traduceri servicii specializări RO
overview: Adăugarea unui strat de traducere EN→RO pentru categorii și specializări (afișare doar în UI, DB rămâne în engleză) și înlocuirea textelor în engleză de pe ecranul Manage Services și oriunde apar serviciile/specializările în frontend.
todos: []
isProject: false
---

# Plan: Traduceri servicii și specializări în română (UI)

## Scop

- Baza de date rămâne în engleză (nici o migrare, nici un schimb la API).
- În interfață: toate numele de categorii și specializări, plus textele de pe ecranul „Gestionează servicii” (Manage Services) și oriunde apar serviciile/specializările să fie în română.

## 1. Modul central de traduceri

**Fișier nou:** [src/constants/serviceTranslations.ts](src/constants/serviceTranslations.ts) (sau `src/utils/serviceTranslations.ts`)

Conține:

- **Mape categorii (nume EN din API → RO):**
  - `Routine Care` → `Îngrijire de rutină`
  - `Dental Care` → `Îngrijire dentară`
  - `Diagnostic Services` → `Servicii diagnostice`
  - `Emergency Care` → `Urgențe`
  - `Surgical Procedures` → `Proceduri chirurgicale`
  - `Grooming` → `Toaletare`
- **Mape specializări (nume EN din API → RO):** toate cele din [006_service_categories_specializations.sql](backend/src/migrations/006_service_categories_specializations.sql), de exemplu:
  - Routine Care: General Checkup → Consult general, Vaccination → Vaccinare, Flea/Tick Prevention → Prevenție purici/căpușe, Deworming → Dehelmintizare, Nail Trimming → Tăiere unghi, Microchipping → Microcip
  - Dental Care: Dental Checkup → Consult stomatologic, Teeth Cleaning → Detartraj, Tooth Extraction → Extracție dinte, Dental X-Ray → Radiografie dentară
  - Diagnostic Services: Blood Test (Basic) → Analiză sanguină (de bază), Blood Test (Comprehensive) → Analiză sanguină (completă), X-Ray → Radiografie, Ultrasound → Ecografie, Urinalysis → Analiză urină, Fecal Exam → Analiză coprologică
  - Emergency Care: Emergency Consultation → Consult urgențe, Emergency Surgery → Chirurgie urgențe, Overnight Hospitalization → Spitalizare, Wound Treatment → Tratament răni, Poison Treatment → Tratament intoxicații
  - Surgical Procedures: Spay (Cat/Dog) → Sterilizare (pisică/câine), Neuter (Cat/Dog) → Castrare (pisică/câine), Soft Tissue Surgery → Chirurgie țesuturi moi, Orthopedic Surgery → Chirurgie ortopedică, Tumor Removal → Ablație tumoare
  - Grooming: Bath & Brush → Baie și periat, Full Grooming → Toaletare completă, Haircut/Trim → Tuns/Aruncat, Ear Cleaning → Curățare urechi, Anal Gland Expression → Expresie glande anale
- **Mapă pentru cheile de categorie (ServiceCategoryType):**
`routine_care`, `dental_care`, `diagnostic_services`, `emergency_care`, `surgical_procedures`, `grooming`, `custom` → același text RO ca mai sus (și `custom` → „Serviciu personalizat” sau „Custom”).
- **Funcții helper:**
  - `translateCategoryName(enName: string): string` — returnează RO din mapă sau `enName` dacă nu există.
  - `translateSpecializationName(enName: string): string` — idem pentru specializări.
  - Export pentru etichete categorii după cheie: de ex. `ServiceCategoryLabelsRO: Record<ServiceCategoryType, string>` (sau o funcție care primește cheia și returnează RO).

Toate textele de mai sus sunt exact traducerile oferite; mapările vor fi implementate în acest fișier.

---

## 2. Fișiere de modificat și ce se schimbă

### 2.1 [src/types/company.types.ts](src/types/company.types.ts)

- **Ce:** Păstrăm `ServiceCategoryLabels` (EN) pentru compatibilitate cu API/DB; adăugăm export pentru etichete RO (sau import din noul modul).
- **Mod:** Fie adăugăm `ServiceCategoryLabelsRO` definit aici și populat cu textele RO, fie importăm din `serviceTranslations.ts` un obiect/funcție pentru afișare în UI. Recomandare: mutăm etichetele RO în [src/constants/serviceTranslations.ts](src/constants/serviceTranslations.ts) și le exportăm de acolo; în `company.types.ts` putem re-exporta dacă e nevoie.

### 2.2 [src/screens/ManageServicesScreen.tsx](src/screens/ManageServicesScreen.tsx)

- **Texte de tradus (în română):**
  - Titlu: „Manage Services” → „Gestionează servicii”
  - Subtitlu: „Add, edit, and organize your clinic services” → „Adaugă, editează și organizează serviciile clinicii”
  - „Loading services...” → „Se încarcă serviciile...”
  - „No services yet” → „Niciun serviciu încă”
  - „Add your first service below...” → „Adaugă primul serviciu mai jos pentru a fi vizibil pentru proprietarii de animale.”
  - „Add New Service” → „Adaugă serviciu nou”
  - Placeholder: „Service name (e.g., Vaccination, Surgery)” → „Denumire serviciu (ex.: Vaccinare, Operație)”
  - „Duration (min)” → „Durată (min)”
  - „Min price ($)” / „Max price ($)” → „Preț min (lei)” / „Preț max (lei)” (sau păstrezi $ dacă moneda rămâne în USD)
  - „Description (optional)” → „Descriere (opțional)”
  - Buton: „Add Service” → „Adaugă serviciu”
  - Chip categorie: în loc de `ServiceCategoryLabels[item.category]` folosim eticheta RO (din noul modul).
  - Meniu categorii: în loc de `Object.entries(ServiceCategoryLabels)` folosim lista RO pentru afișare; valoarea trimisă la API rămâne cheia EN.
  - Alert-uri: „Service name is required” → „Denumirea serviciului este obligatorie”; „Max price must be >= min price” → „Prețul maxim trebuie să fie >= prețul minim”; „Service created” → „Serviciu creat”; „Delete service” / „Are you sure...” → „Șterge serviciu” / „Sigur vrei să ștergi acest serviciu?”; „Cancel” / „Delete” → „Anulare” / „Șterge”; „Failed to load services” / „Failed to delete service” → mesaje echivalente în română.

### 2.3 [src/components/Dashboard/CategoryCard.tsx](src/components/Dashboard/CategoryCard.tsx)

- **Unde:**
  - `category.name` (titlu categorie) → `translateCategoryName(category.name)`.
  - `category.description` (dacă e afișat) → opțional: mapare descrieri EN→RO sau păstrăm EN; planul minimal: doar nume.
  - `specialization.name` (listă specializări) → `translateSpecializationName(specialization.name)`.
  - Butoane: „Add service” → „Adaugă serviciu”, „Cancel” → „Anulare”.
- **Fără schimb:** `getCategoryIcon` și logica pe `category.name` pentru icon pot rămâne pe numele EN (sau pe cheie) pentru stabilitate.

### 2.4 [src/components/FormComponents/CategorySpecializationPicker.tsx](src/components/FormComponents/CategorySpecializationPicker.tsx)

- **Unde:**
  - `category.name` (header categorie și conținut) → `translateCategoryName(category.name)`.
  - `specialization.name` (fiecare specializare) → `translateSpecializationName(specialization.name)`.
  - „X specialization(s) selected” → „X specializare(ri) selectate”.
  - „(at least 1 required)” → „(minim 1 obligatoriu)”.
  - „Select all” / „Deselect all” → „Selectează toate” / „Deselectează toate”.
  - `accessibilityLabel` cu „category” / „selected” pot fi traduse pentru consistență.

### 2.5 [src/components/FormComponents/SpecializationPricingForm.tsx](src/components/FormComponents/SpecializationPricingForm.tsx)

- **Unde:**
  - La afișarea secțiunilor pe categorii: `categoryName` (din `spec.category_name`) → `translateCategoryName(categoryName)`.
  - La carduri servicii: `spec.name` → `translateSpecializationName(spec.name)`.
  - Textul de tip „X service(s)” în header secțiune → „X serviciu(uri)”.
  - `accessibilityLabel` cu „Minimum price for …” etc. → variante în română.

### 2.6 [src/components/FormComponents/AddCustomServiceModal.tsx](src/components/FormComponents/AddCustomServiceModal.tsx)

- **Unde:** La listă categorii, `category.name` → `translateCategoryName(category.name)`. „Selectează o categorie (opțional)” e deja în română; „Select category” (accessibility/label) → „Selectează categoria”.

### 2.7 [src/screens/CreateCompany/Step4Pricing.tsx](src/screens/CreateCompany/Step4Pricing.tsx)

- **Unde:** `categoryName` afișat (din `categories.find(...).name` sau „Custom”) → `translateCategoryName(categoryName)`.

### 2.8 [src/screens/VetCompanyDetailScreen.tsx](src/screens/VetCompanyDetailScreen.tsx)

- **Unde:** În loc de `ServiceCategoryLabels[category]` (sau „Other Services”) folosim eticheta RO din noul modul (după cheie sau după nume EN, în funcție cum vine `category` din date).

### 2.9 [src/components/ServiceSelectionSheet.tsx](src/components/ServiceSelectionSheet.tsx)

- **Unde:** În loc de `ServiceCategoryLabels[category]` folosim eticheta RO.

### 2.10 [src/components/FormComponents/ServiceListBuilder.tsx](src/components/FormComponents/ServiceListBuilder.tsx)

- **Unde:** Toate afișările care folosesc `ServiceCategoryLabels[template.category]` sau `label` din `Object.entries(ServiceCategoryLabels)` → folosim etichetele RO pentru UI. Placeholder „e.g., General Checkup” → „ex.: Consult general”.

### 2.11 [src/screens/CompanyDashboardScreen.tsx](src/screens/CompanyDashboardScreen.tsx)

- **Unde:** „Total Services” (lângă categorii) → „Total servicii”. Dacă undeva se afișează `company.specializations` ca texte, acestea pot veni din API ca string-uri; dacă sunt nume de specializări, le trecem prin `translateSpecializationName`.

### 2.12 [src/components/Dashboard/QuickActions.tsx](src/components/Dashboard/QuickActions.tsx)

- **Unde:** Label-ul butonului care duce la Manage Services (ex. „Manage Services” / „Gestionează servicii”) → „Gestionează servicii” (sau textul exact folosit în design).

### 2.13 Alte ecrane unde apar servicii

- **[src/screens/MyAppointmentsScreen.tsx](src/screens/MyAppointmentsScreen.tsx):** unde se afișează `s.service_name` sau „Service” → dacă `service_name` vine din DB în engleză (nume de specializare), putem afișa `translateSpecializationName(s.service_name)` sau `translateSpecializationName(s.name)`; fallback „Service” → „Serviciu”.
- **[src/screens/UserDashboardScreen.tsx](src/screens/UserDashboardScreen.tsx):** dacă există listă de servicii cu `s.service_name || s.name || 'Service'` → același tratament: traducere nume + „Serviciu” ca fallback.

---

## 3. Ordine recomandată de implementare

1. Creare [src/constants/serviceTranslations.ts](src/constants/serviceTranslations.ts) cu toate mapele (categorii, specializări, etichete pentru ServiceCategoryType) și funcțiile `translateCategoryName`, `translateSpecializationName` (și export pentru etichete RO după cheie).
2. Înlocuire în [ManageServicesScreen.tsx](src/screens/ManageServicesScreen.tsx): texte statice + folosire etichete RO pentru categorii.
3. Înlocuire în [CategoryCard.tsx](src/components/Dashboard/CategoryCard.tsx), [CategorySpecializationPicker.tsx](src/components/FormComponents/CategorySpecializationPicker.tsx), [SpecializationPricingForm.tsx](src/components/FormComponents/SpecializationPricingForm.tsx), [AddCustomServiceModal.tsx](src/components/FormComponents/AddCustomServiceModal.tsx), [Step4Pricing.tsx](src/screens/CreateCompany/Step4Pricing.tsx) pentru toate afișările de `category.name` și `specialization.name` + textele „Add service”, „Cancel”, „selected”, „required”, etc.
4. Înlocuire în [VetCompanyDetailScreen.tsx](src/screens/VetCompanyDetailScreen.tsx), [ServiceSelectionSheet.tsx](src/components/ServiceSelectionSheet.tsx), [ServiceListBuilder.tsx](src/components/FormComponents/ServiceListBuilder.tsx) pentru etichete categorii RO.
5. CompanyDashboardScreen („Total Services”), QuickActions („Gestionează servicii”), MyAppointmentsScreen / UserDashboardScreen (nume servicii + fallback „Serviciu”).

---

## 4. Rezumat fișiere


| Fișier                                                           | Modificări                                                                                                                          |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Nou:** `src/constants/serviceTranslations.ts`                  | Mape EN→RO categorii + specializări, etichete RO pentru ServiceCategoryType, `translateCategoryName`, `translateSpecializationName` |
| `src/screens/ManageServicesScreen.tsx`                           | Toate textele UI în română; categorii afișate cu etichete RO                                                                        |
| `src/components/Dashboard/CategoryCard.tsx`                      | `category.name` și `specialization.name` prin funcțiile de traducere; butoane „Adaugă serviciu” / „Anulare”                         |
| `src/components/FormComponents/CategorySpecializationPicker.tsx` | Nume categorii/specializări traduse; „specializare(ri) selectate”, „Selectează toate” etc.                                          |
| `src/components/FormComponents/SpecializationPricingForm.tsx`    | Nume categorii și specializări traduse; „serviciu(uri)”                                                                             |
| `src/components/FormComponents/AddCustomServiceModal.tsx`        | Nume categorii traduse în listă                                                                                                     |
| `src/screens/CreateCompany/Step4Pricing.tsx`                     | Nume categorie afișat tradus                                                                                                        |
| `src/screens/VetCompanyDetailScreen.tsx`                         | Etichete categorii RO                                                                                                               |
| `src/components/ServiceSelectionSheet.tsx`                       | Etichete categorii RO                                                                                                               |
| `src/components/FormComponents/ServiceListBuilder.tsx`           | Etichete categorii RO; placeholder „Consult general”                                                                                |
| `src/screens/CompanyDashboardScreen.tsx`                         | „Total servicii”; eventual traducere nume specializări dacă sunt afișate                                                            |
| `src/components/Dashboard/QuickActions.tsx`                      | Label „Gestionează servicii” pentru butonul Manage Services                                                                         |
| `src/screens/MyAppointmentsScreen.tsx`                           | Traducere nume servicii (dacă sunt din listă fixă); fallback „Serviciu”                                                             |
| `src/screens/UserDashboardScreen.tsx`                            | La fel pentru orice afișare nume serviciu                                                                                           |


Traducerile oferite mai sus (Îngrijire de rutină, Consult general, Vaccinare, etc.) sunt cele care vor fi folosite în acest modul și în UI; baza de date nu este modificată.
