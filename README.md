### **Agent Instructions: ZenMoney Plugin Development**
You are an expert TypeScript developer specializing in creating and maintaining plugins for the **ZenMoney** finance tracking platform. Your goal is to write robust, clean, and strictly linted code that parses bank statements of Kazakh Fortebank (PDF) and converts them into ZenMoney data structures.
The plugin folder is already created as 'src/plugins/fortebank-kz' mostly by copying the 'example' plugin as recommended by Zenmoney statup guide.

#### **Linter & Formatting Standards (`ts-standard`)**

This project uses a very strict linter. You **MUST** follow these rules to avoid build failures:
  * **Indentation:** Use **2 spaces** (not tabs).
  * **Semicolons:** **NEVER** use semicolons at the end of statements.
  * **Quotes:** Use **single quotes** (`'`) for all strings unless template literals are required.
  * **Trailing Spaces:** Absolutely **NO** trailing whitespace on any line (including empty lines).
  * **Function Spacing:** Always put a space before function parentheses:
      * *Correct:* `function normalizeText (text: string) { ... }`
      * *Incorrect:* `function normalizeText(text: string) { ... }`
  * **Object Shorthand:** Always use object shorthand properties where possible (`{ value }` instead of `{ value: value }`).
  * **Optional Chaining:** Prefer `?.` over verbose null checks (`headerMatch?.index` instead of `headerMatch && headerMatch.index`).
  * **String Checking:** Use `.includes()` instead of Regex for simple substring checks.
  * **Casting:** Avoid wrapping casts in parentheses immediately followed by a property access (confuses the linter).
      * *Bad:* `(parsePdf as jest.Mock).mockReturnValue(...)`
      * *Good:* `const mock = parsePdf as jest.Mock; mock.mockReturnValue(...)`

#### **PDF Parsing Strategy**

Real-life samples of PDF statemets for different currencies and locales are located in 'confidential_PDF_statenments' subfolder of the plugin.
Naming convention is 'statement_{currency}_{language}.pdf

When writing parsers for bank statements consider following

  * **Localization** recognize the locale via a function that accepts text scraped from the PDF statement and tries to locate an English word "Statement" or its equivalent in Russian or Kazakh and set up locale based on the search result. As the most of the parsing will be done with regular expressions, there should be a well-oranized list of regexp constants that will be plugged in based on the identified locale (some of regexp for dates and values should remain generic).

  * **Structure-aware parsing**
  The text scraped from a bank statement PDF document. Important: The text scraped from PDF is known to be 'spased out'(e.g. "TEXT" in PDF is scraped as "T E X T")
  The whole document content can be logically split into 3 sections:
        section#1: the header with account details where it should be possible to find certain account-level values and the text is not supposed to be rendered thus does not need to be beautified.
        section#2: the main multi-page table with a fixed sequence of values in each row:
          1. date
          2. sum (in currency) positive or negative
          3. operation (one of the list values mostly)
            Note: there could be rare misfits (value which could not be recognized as a list value). Those should be considered as 'bugs' of the Fortebank statement rendering service and such text should not be considered as an operation identifier, instead the operation should be recognied from the sign of the sum (i.e. negative means 'Purchase' and positive is 'Account Replenishment') and the misfitted text is concatenated to the transaction details.
          4. details: as a free text till the beginning of the next row's date
        section#3: the attic which does not contain any useful information and thus can be skipped. 
        
        So the general idea for parsing logic is to split the scraped text into 3 sub-strings beforehand and then
        * use #1 sub-string with lookup functions only (no need to clean up, or just very simple cleanup)
        * structure-aware parser for the #2 sub-string to extract values of known format and normzlize free-text values
        * sub-string #3 just throw out as not required

  * **Free-text Normalization:** free-text from detailed descriptions should follow known best-practices that:
      * Removes artifacts like quotes (`"`, `'`).
      * **Crucial:** Removes single spaces to handle "spaced out" text (e.g., "T E X T" -\> "TEXT").
      * **Preserves Newlines:** Do not always strip `\n`; line breaks are vital for detailization text value.

  * **Tabular Data Separator** Once locale is defined, there're pre-defined "header" string, not regex but just known string (concatenated names of transaction table columns) EN: "D a t e S u m D e s c r i p t i o n D e t a i l s", KZ: "К ү н і С о м а C и п а т т а м а с ы Т а л д а м а", RU: "Д а т а С у м м а О п и с а н и е Д е т а л и з а ц и я" (raw strings are spaced out)
  Transactions data begins and ends with the header strings and also the header strings occur on any new page as a splitter (in case of multi-page PDF is scrapped). So before starting parsingthe parsing count all "header" strings and then
      * text before the first occurence is considered as a statement header which shoul be parsed for general information
      * text between the first and the last occurences is considered transactions data
      * text below the last occurence is considered attic and should be skipped completely 

#### **4. Testing Strategy**
Unit-tests are executed as 'yarn test fortebank-kz'

## Zenmoney General Information
Zenmoney brings together data from all of your accounts and cards to create a complete picture.
These plugins do the job.

---
- Plugins in this repository are developed by the community.
- All new plugins must be created in TypeScript according to our guidelines.
- In simple words, the plugin requests the bank to get your accounts and transactions,
then converts them into our unified format.
- Plugins are downloaded to the app and run entirely on your device.
  Thus, your bank credentials are stored securely and do not leave your device.

Some banks have an open API with documentation. For example, in Europe,
there is PSD2 Directive, so all European banks have a standardized API.
In all other cases, we have to reverse-engineer banking websites
or mobile apps to create a JS plugin.

## Contribution
We are always looking to expand the coverage of our plugins, but
if your bank is still unsupported, and you have skills in TypeScript + basic reverse engineering,
you can help us — create a plugin by yourself.
So after a successful merge, all users will be able to use it.

To get started, look at our https://github.com/zenmoney/ZenPlugins/blob/master/docs/README.md

