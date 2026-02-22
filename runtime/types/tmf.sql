DROP SCHEMA IF EXISTS tmf CASCADE;
CREATE SCHEMA tmf;
SET search_path TO tmf;

-- Another Characteristic that is related to the current Characteristic;
CREATE TYPE "CharacteristicRelationship" AS ("id" text, "relationshipType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Describes a given characteristic of an object or entity through a name/value pair. This is an abstract base class, the actual value is in one of the strongly-typed subclasses : StringCharacteristic, ObjectCharacteristic, FloatCharacteristic, BooleanCharacteristic, NumberCharacteristic, IntegerCharacteristic, StringArrayCharacteristic, ObjectArrayCharacteristic, BooleanArrayCharacteristic, NumberArrayCharacteristic, IntegerArrayCharacteristic...
CREATE TYPE "Characteristic" AS ("id" text, "name" text, "valueType" text, "characteristicRelationship" "CharacteristicRelationship"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- A characteristic which value is an array of Boolean(s).
CREATE TYPE "BooleanArrayCharacteristic" AS ("value" boolean[], "id" text, "name" text, "valueType" text, "characteristicRelationship" "CharacteristicRelationship"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- A characteristic which value is a Boolean.
CREATE TYPE "BooleanCharacteristic" AS ("value" boolean, "id" text, "name" text, "valueType" text, "characteristicRelationship" "CharacteristicRelationship"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- A characteristic which value is an array of Float(s).
CREATE TYPE "FloatArrayCharacteristic" AS ("value" real[], "id" text, "name" text, "valueType" text, "characteristicRelationship" "CharacteristicRelationship"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- A characteristic which value is a Float.
CREATE TYPE "FloatCharacteristic" AS ("value" real, "id" text, "name" text, "valueType" text, "characteristicRelationship" "CharacteristicRelationship"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- A characteristic which value is an array of Integer(s).
CREATE TYPE "IntegerArrayCharacteristic" AS ("value" integer[], "id" text, "name" text, "valueType" text, "characteristicRelationship" "CharacteristicRelationship"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- A characteristic which value is a Integer.
CREATE TYPE "IntegerCharacteristic" AS ("value" integer, "id" text, "name" text, "valueType" text, "characteristicRelationship" "CharacteristicRelationship"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- A characteristic which value is an array of Number(s).
CREATE TYPE "NumberArrayCharacteristic" AS ("value" real[], "id" text, "name" text, "valueType" text, "characteristicRelationship" "CharacteristicRelationship"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- A characteristic which value is a Number.
CREATE TYPE "NumberCharacteristic" AS ("value" real, "id" text, "name" text, "valueType" text, "characteristicRelationship" "CharacteristicRelationship"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- A characteristic which value is an array of Object(s).
CREATE TYPE "ObjectArrayCharacteristic" AS ("value" jsonb[], "id" text, "name" text, "valueType" text, "characteristicRelationship" "CharacteristicRelationship"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- A characteristic which value is a Object.
CREATE TYPE "ObjectCharacteristic" AS ("value" jsonb, "id" text, "name" text, "valueType" text, "characteristicRelationship" "CharacteristicRelationship"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- A characteristic which value is an array of String(s).
CREATE TYPE "StringArrayCharacteristic" AS ("value" text[], "id" text, "name" text, "valueType" text, "characteristicRelationship" "CharacteristicRelationship"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- A characteristic which value is a String.
CREATE TYPE "StringCharacteristic" AS ("value" text, "id" text, "name" text, "valueType" text, "characteristicRelationship" "CharacteristicRelationship"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- Provides the value of a given characteristic
CREATE TYPE "CdrCharacteristic" AS ("id" text, "name" text, "valueType" text, "characteristicRelationship" "CharacteristicRelationship"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- A definition of a characteristic for which the value is a mapped object
CREATE TYPE "MapAnyCharacteristicValue" AS ("value" jsonb, "id" text, "name" text, "valueType" text, "characteristicRelationship" "CharacteristicRelationship"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- Describes a given characteristic of an object or entity through a name/value pair. This is an abstract base class, the actual value is in one of the strongly-typed subclasses : StringCharacteristic, ObjectCharacteristic, FloatCharacteristic, BooleanCharacteristic, NumberCharacteristic, IntegerCharacteristic, StringArrayCharacteristic, ObjectArrayCharacteristic, BooleanArrayCharacteristic, NumberArrayCharacteristic, IntegerArrayCharacteristic...
CREATE TYPE "OneOfCharacteristic" AS ("Characteristic" "Characteristic", "BooleanArrayCharacteristic" "BooleanArrayCharacteristic", "BooleanCharacteristic" "BooleanCharacteristic", "FloatArrayCharacteristic" "FloatArrayCharacteristic", "FloatCharacteristic" "FloatCharacteristic", "IntegerArrayCharacteristic" "IntegerArrayCharacteristic", "IntegerCharacteristic" "IntegerCharacteristic", "NumberArrayCharacteristic" "NumberArrayCharacteristic", "NumberCharacteristic" "NumberCharacteristic", "ObjectArrayCharacteristic" "ObjectArrayCharacteristic", "ObjectCharacteristic" "ObjectCharacteristic", "StringArrayCharacteristic" "StringArrayCharacteristic", "StringCharacteristic" "StringCharacteristic", "CdrCharacteristic" "CdrCharacteristic", "MapAnyCharacteristicValue" "MapAnyCharacteristicValue");

-- Base Extensible schema for use in TMForum Open-APIs - When used for in a schema it means that the Entity described by the schema  MUST be extended with the @type
CREATE TYPE "Extensible" AS ("@type" text, "@baseType" text, "@schemaLocation" text);

-- A period of time, either as a deadline (endDateTime only) a startDateTime only, or both
CREATE TYPE "TimePeriod" AS ("startDateTime" timestamp(0) with time zone, "endDateTime" timestamp(0) with time zone);

-- Indicates the contact medium that could be used to contact the party. This is an abstract base class, the actual value is in one of the strongly-typed subclasses : EmailContactMedium, FaxContactMedium, PhoneContactMedium, GeographicAddressContactMedium, SocialMediaContactMedium...
CREATE TYPE "ContactMedium" AS ("id" text, "preferred" boolean, "contactType" text, "validFor" "TimePeriod", "@type" text, "@baseType" text, "@schemaLocation" text);

-- Describes an email that could be used to contact a party (an individual or an organization)
CREATE TYPE "EmailContactMedium" AS ("emailAddress" text, "id" text, "preferred" boolean, "contactType" text, "validFor" "TimePeriod", "@type" text, "@baseType" text, "@schemaLocation" text);

-- Describes a fax that could be used to contact a party (an individual or an organization)
CREATE TYPE "FaxContactMedium" AS ("faxNumber" text, "id" text, "preferred" boolean, "contactType" text, "validFor" "TimePeriod", "@type" text, "@baseType" text, "@schemaLocation" text);

-- Reference to a Geographic Address.
CREATE TYPE "GeographicAddressRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Describes a geographical address that could be used to contact a party (an individual or an organization)
CREATE TYPE "GeographicAddressContactMedium" AS ("city" text, "country" text, "postCode" text, "stateOrProvince" text, "street1" text, "street2" text, "geographicAddress" "GeographicAddressRef", "id" text, "preferred" boolean, "contactType" text, "validFor" "TimePeriod", "@type" text, "@baseType" text, "@schemaLocation" text);

-- Describes a phone number that could be used to contact a party (an individual or an organization)
CREATE TYPE "PhoneContactMedium" AS ("phoneNumber" text, "id" text, "preferred" boolean, "contactType" text, "validFor" "TimePeriod", "@type" text, "@baseType" text, "@schemaLocation" text);

-- Describes a social media identifier that could be used to contact a party (an individual or an organization)
CREATE TYPE "SocialContactMedium" AS ("socialNetworkId" text, "id" text, "preferred" boolean, "contactType" text, "validFor" "TimePeriod", "@type" text, "@baseType" text, "@schemaLocation" text);

-- Indicates the contact medium that could be used to contact the party. This is an abstract base class, the actual value is in one of the strongly-typed subclasses : EmailContactMedium, FaxContactMedium, PhoneContactMedium, GeographicAddressContactMedium, SocialMediaContactMedium...
CREATE TYPE "OneOfContactMedium" AS ("ContactMedium" "ContactMedium", "EmailContactMedium" "EmailContactMedium", "FaxContactMedium" "FaxContactMedium", "GeographicAddressContactMedium" "GeographicAddressContactMedium", "PhoneContactMedium" "PhoneContactMedium", "SocialContactMedium" "SocialContactMedium");

-- Entity reference schema to be use for all entityRef class.
CREATE TYPE "EntityRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A Party reference
CREATE TYPE "PartyRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Party role reference. A party role represents the part played by a party in a given context.
CREATE TYPE "PartyRoleRef" AS ("partyId" text, "partyName" text, "id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

CREATE TYPE "OneOfPartyRefOrPartyRoleRef" AS ("PartyRef" "PartyRef", "PartyRoleRef" "PartyRoleRef");

-- RelatedParty reference. A related party defines party or party role or its reference, linked to a specific entity
CREATE TYPE "RelatedPartyRefOrPartyRoleRef" AS ("role" text, "partyOrPartyRole" "OneOfPartyRefOrPartyRoleRef", "@type" text, "@baseType" text, "@schemaLocation" text);

-- Reference to Party Privacy Agreement resource
CREATE TYPE "PartyPrivacyAgreementRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Reference to Party Privacy Specification resource
CREATE TYPE "PartyPrivacyProfileSpecificationRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A characteristic for an instantiated party profile, where the value indicates the allowed use of the characteristic
CREATE TYPE "PartyPrivacyProfileCharacteristic" AS ("characterisitc" "OneOfCharacteristic", "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "privacyUsagePurpose" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A Party Privacy Profile represents the set of Privacy settings defined for a Party
CREATE TYPE "PartyPrivacyProfile" AS ("applicableForParty" "RelatedPartyRefOrPartyRoleRef", "agreement" "PartyPrivacyAgreementRef", "creationDate" timestamp(0) with time zone, "lastUpdate" timestamp(0) with time zone, "description" text, "name" text, "status" text, "validFor" "TimePeriod", "partyPrivacyProfileSpecification" "PartyPrivacyProfileSpecificationRef", "partyPrivacyProfileCharacteristic" "PartyPrivacyProfileCharacteristic"[], "agreedByParty" "RelatedPartyRefOrPartyRoleRef", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A Party Privacy Profile represents the set of Privacy settings defined for a Party
CREATE TABLE "partyPrivacyProfile" ("applicableForParty" "RelatedPartyRefOrPartyRoleRef", "agreement" "PartyPrivacyAgreementRef", "creationDate" timestamp(0) with time zone, "lastUpdate" timestamp(0) with time zone, "description" text, "name" text, "status" text, "validFor" "TimePeriod", "partyPrivacyProfileSpecification" "PartyPrivacyProfileSpecificationRef", "partyPrivacyProfileCharacteristic" "PartyPrivacyProfileCharacteristic"[], "agreedByParty" "RelatedPartyRefOrPartyRoleRef", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Agreement specification reference. An AgreementSpecification represents a template of an agreement that can be used when establishing partnerships.
CREATE TYPE "AgreementSpecificationRef" AS ("description" text, "name" text, "id" text, "href" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A PartyPrivacyRoleSpecification represents a specification of a role defined in the context of a given privacy spesification, such as Customer, User.
CREATE TYPE "PartyPrivacyRoleSpecification" AS ("agreementSpecification" "AgreementSpecificationRef"[], "id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- ProductOffering reference. A product offering represents entities that are orderable from the provider of the catalog, this resource includes pricing information.
CREATE TYPE "ProductOfferingRef" AS ("version" text, "id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Party role specification reference. A party role specification gives additional details on the part played by a party in a given context.
CREATE TYPE "PartyRoleSpecificationRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Party role specification reference. A party role specification gives additional details on the part played by a party in a given context.
CREATE TYPE "OneOfPartyRoleSpecificationRef" AS ("PartyRoleSpecificationRef" "PartyRoleSpecificationRef", "PartyPrivacyRoleSpecification" "PartyPrivacyRoleSpecification");

-- An aggregation, migration, substitution, dependency or exclusivity relationship between/among Characteristic specifications. The specification characteristic is embedded within the specification whose ID and href are in this entity, and identified by its ID.
CREATE TYPE "CharacteristicSpecificationRelationship" AS ("relationshipType" text, "name" text, "characteristicSpecificationId" text, "parentSpecificationHref" text, "validFor" "TimePeriod", "parentSpecificationId" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- specification of a value (number or text or an object) that can be assigned to a Characteristic. This is an abstract base class, the actual value is in one of the strongly-typed subclasses
CREATE TYPE "CharacteristicValueSpecification" AS ("valueType" text, "isDefault" boolean, "unitOfMeasure" text, "validFor" "TimePeriod", "valueFrom" integer, "valueTo" integer, "rangeInterval" text, "regex" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A specification for a characteristic for which the value is a string
CREATE TYPE "StringCharacteristicValueSpecification" AS ("value" text, "valueType" text, "isDefault" boolean, "unitOfMeasure" text, "validFor" "TimePeriod", "valueFrom" integer, "valueTo" integer, "rangeInterval" text, "regex" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A specification for a characteristic for which the value is an array of strings
CREATE TYPE "StringArrayCharacteristicValueSpecification" AS ("value" text[], "valueType" text, "isDefault" boolean, "unitOfMeasure" text, "validFor" "TimePeriod", "valueFrom" integer, "valueTo" integer, "rangeInterval" text, "regex" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A specification for a characteristic for which the value is any object
CREATE TYPE "ObjectCharacteristicValueSpecification" AS ("value" jsonb, "valueType" text, "isDefault" boolean, "unitOfMeasure" text, "validFor" "TimePeriod", "valueFrom" integer, "valueTo" integer, "rangeInterval" text, "regex" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A specification for a characteristic for which the value is an array of objects
CREATE TYPE "ObjectArrayCharacteristicValueSpecification" AS ("value" jsonb[], "valueType" text, "isDefault" boolean, "unitOfMeasure" text, "validFor" "TimePeriod", "valueFrom" integer, "valueTo" integer, "rangeInterval" text, "regex" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A specification for a characteristic for which the value is a number of no specific format
CREATE TYPE "NumberCharacteristicValueSpecification" AS ("value" real, "valueType" text, "isDefault" boolean, "unitOfMeasure" text, "validFor" "TimePeriod", "valueFrom" integer, "valueTo" integer, "rangeInterval" text, "regex" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A specification for a characteristic for which the value is a number array with no specific format 
CREATE TYPE "NumberArrayCharacteristicValueSpecification" AS ("value" real[], "valueType" text, "isDefault" boolean, "unitOfMeasure" text, "validFor" "TimePeriod", "valueFrom" integer, "valueTo" integer, "rangeInterval" text, "regex" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A specification for a characteristic for which the value is a mapped object
CREATE TYPE "MapCharacteristicValueSpecification" AS ("value" jsonb, "valueType" text, "isDefault" boolean, "unitOfMeasure" text, "validFor" "TimePeriod", "valueFrom" integer, "valueTo" integer, "rangeInterval" text, "regex" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A specification for a characteristic for which the value is an array of mapped objects
CREATE TYPE "MapArrayCharacteristicValueSpecification" AS ("value" jsonb[], "valueType" text, "isDefault" boolean, "unitOfMeasure" text, "validFor" "TimePeriod", "valueFrom" integer, "valueTo" integer, "rangeInterval" text, "regex" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A specification for a characteristic for which the value is an integer number
CREATE TYPE "IntegerCharacteristicValueSpecification" AS ("value" integer, "valueType" text, "isDefault" boolean, "unitOfMeasure" text, "validFor" "TimePeriod", "valueFrom" integer, "valueTo" integer, "rangeInterval" text, "regex" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A specification for a characteristic for which the value is a number array of format integer
CREATE TYPE "IntegerArrayCharacteristicValueSpecification" AS ("value" integer[], "valueType" text, "isDefault" boolean, "unitOfMeasure" text, "validFor" "TimePeriod", "valueFrom" integer, "valueTo" integer, "rangeInterval" text, "regex" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- specification of a value (number or text or an object) that can be assigned to a Characteristic. This is an abstract base class, the actual value is in one of the strongly-typed subclasses
CREATE TYPE "OneOfCharacteristicValueSpecification" AS ("CharacteristicValueSpecification" "CharacteristicValueSpecification", "StringCharacteristicValueSpecification" "StringCharacteristicValueSpecification", "StringArrayCharacteristicValueSpecification" "StringArrayCharacteristicValueSpecification", "ObjectCharacteristicValueSpecification" "ObjectCharacteristicValueSpecification", "ObjectArrayCharacteristicValueSpecification" "ObjectArrayCharacteristicValueSpecification", "NumberCharacteristicValueSpecification" "NumberCharacteristicValueSpecification", "NumberArrayCharacteristicValueSpecification" "NumberArrayCharacteristicValueSpecification", "MapCharacteristicValueSpecification" "MapCharacteristicValueSpecification", "MapArrayCharacteristicValueSpecification" "MapArrayCharacteristicValueSpecification", "IntegerCharacteristicValueSpecification" "IntegerCharacteristicValueSpecification", "IntegerArrayCharacteristicValueSpecification" "IntegerArrayCharacteristicValueSpecification");

-- A characteristic of the party privacy profile, whose value(s) would be supplied at runtime. For example, email address
CREATE TYPE "PartyPrivacyProfileSpecificationCharacteristic" AS ("name" text, "description" text, "criticalityLevel" text, "privacyUsagePurpose" text, "privacyType" text, "allowedRole" "OneOfPartyRoleSpecificationRef"[], "validFor" "TimePeriod", "id" text, "valueType" text, "configurable" boolean, "minCardinality" integer, "maxCardinality" integer, "isUnique" boolean, "regex" text, "extensible" boolean, "@valueSchemaLocation" text, "charSpecRelationship" "CharacteristicSpecificationRelationship"[], "characteristicValueSpecification" "OneOfCharacteristicValueSpecification"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- Party Privacy Profile Specification serves as a template for creating Privacy Profiles. The specification defines characteristics for the profile. For example there might be a profile specification for residential customers, and a different specification for partners.
CREATE TYPE "PartyPrivacyProfileSpecification" AS ("description" text, "applicableRole" "PartyPrivacyRoleSpecification"[], "lastUpdate" timestamp(0) with time zone, "lifecycleStatus" text, "name" text, "productOffering" "ProductOfferingRef"[], "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "validFor" "TimePeriod", "version" text, "specCharacteristic" "PartyPrivacyProfileSpecificationCharacteristic"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Party Privacy Profile Specification serves as a template for creating Privacy Profiles. The specification defines characteristics for the profile. For example there might be a profile specification for residential customers, and a different specification for partners.
CREATE TABLE "partyPrivacyProfileSpecification" ("description" text, "applicableRole" "PartyPrivacyRoleSpecification"[], "lastUpdate" timestamp(0) with time zone, "lifecycleStatus" text, "name" text, "productOffering" "ProductOfferingRef"[], "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "validFor" "TimePeriod", "version" text, "specCharacteristic" "PartyPrivacyProfileSpecificationCharacteristic"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Reference to Party Privacy Profile resource
CREATE TYPE "PartyPrivacyProfileRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Aspects of the agreement not formally specified elsewhere in the agreement and that cannot be captured elsewhere in a formal notation, or automatically monitored and require a more human level of management.
CREATE TYPE "AgreementTermOrCondition" AS ("description" text, "id" text, "validFor" "TimePeriod", "@type" text, "@baseType" text, "@schemaLocation" text);

-- A part of the agreement expressed in terms of a product offering and possibly including specific terms and conditions.
CREATE TYPE "AgreementItem" AS ("id" text, "termOrCondition" "AgreementTermOrCondition"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- A Product reference
CREATE TYPE "ProductRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A part of the agreement expressed in terms of a product offering and possibly including specific terms and conditions.
CREATE TYPE "ProductAgreementItem" AS ("id" text, "productOffering" "ProductOfferingRef"[], "termOrCondition" "AgreementTermOrCondition"[], "product" "ProductRef"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- A part of the agreement expressed in terms of a product offering and possibly including specific terms and conditions.
CREATE TYPE "OneOfAgreementItem" AS ("AgreementItem" "AgreementItem", "ProductAgreementItem" "ProductAgreementItem");

-- An amount in a given unit
CREATE TYPE "Quantity" AS ("amount" real, "units" text);

-- Complements the description of an element (for instance a product) through video, pictures...
CREATE TYPE "Attachment" AS ("name" text, "description" text, "url" text, "content" text, "size" "Quantity", "validFor" "TimePeriod", "attachmentType" text, "mimeType" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Attachment reference. An attachment complements the description of an element (for instance a product) through video, pictures
CREATE TYPE "AttachmentRef" AS ("description" text, "url" text, "id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The polymorphic attributes @type, @schemaLocation & @referredType are related to the Attachment entity and not the AttachmentRefOrValue class itself
CREATE TYPE "OneOfAttachmentRefOrValue" AS ("Attachment" "Attachment", "AttachmentRef" "AttachmentRef");

-- Reference to a category in the catalog.
CREATE TYPE "CategoryRef" AS ("version" text, "id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Entity reference schema to be use for all entityRef class.
CREATE TYPE "DocumentRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A document specification reference
CREATE TYPE "DocumentSpecification" AS ("URL" text, "name" text, "version" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A reference to an entity, where the type of the entity is not known in advance.
CREATE TYPE "RelatedEntity" AS ("role" text, "entity" "EntityRef", "@type" text, "@baseType" text, "@schemaLocation" text);

-- Document is a tangible output from an activity
CREATE TYPE "Document" AS ("attachment" "OneOfAttachmentRefOrValue"[], "category" "CategoryRef"[], "characteristic" "OneOfCharacteristic"[], "creationDate" timestamp(0) with time zone, "description" text, "documentRelationship" "DocumentRef"[], "documentSpecification" "DocumentSpecification", "lastUpdate" timestamp(0) with time zone, "lifecycleState" text, "relatedEntity" "RelatedEntity", "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "documentType" text, "version" text, "name" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

CREATE TYPE "OneOfDocumentRefOrValue" AS ("Document" "Document", "DocumentRef" "DocumentRef");

-- Entity reference. The polymorphic attributes @type, @schemaLocation & @referredType are related to the DocumentRefOrValue entity and not the RelatedDocumentRefOrValue class itself
CREATE TYPE "RelatedDocumentRefOrValue" AS ("role" text, "document" "OneOfDocumentRefOrValue", "@type" text, "@baseType" text, "@schemaLocation" text);

-- A business participant that is responsible for approving the agreement.
CREATE TYPE "AgreementAuthorization" AS ("date" timestamp(0) with time zone, "signatureRepresentation" text, "state" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A uni-directionmal relationship from this agreement to another agreement
CREATE TYPE "AgreementRelationship" AS ("id" text, "name" text, "relationshipType" text, "validFor" "TimePeriod", "href" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A specific type of agreement that formalizes the privacy profiles requested for a party
CREATE TYPE "PartyPrivacyAgreement" AS ("partyPrivacyProfile" "PartyPrivacyProfileRef"[], "partyPrivacyProfileCharacteristic" "PartyPrivacyProfileCharacteristic"[], "name" text, "agreementType" text, "agreementItem" "OneOfAgreementItem"[], "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "engagedParty" "OneOfPartyRefOrPartyRoleRef"[], "agreementPeriod" "TimePeriod", "completionDate" "TimePeriod", "description" text, "relatedDocument" "RelatedDocumentRefOrValue"[], "initialDate" timestamp(0) with time zone, "statementOfIntent" text, "status" text, "version" text, "agreementSpecification" "AgreementSpecificationRef", "agreementAuthorization" "AgreementAuthorization"[], "characteristic" "OneOfCharacteristic"[], "agreementRelationship" "AgreementRelationship"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A specific type of agreement that formalizes the privacy profiles requested for a party
CREATE TABLE "partyPrivacyAgreement" ("partyPrivacyProfile" "PartyPrivacyProfileRef"[], "partyPrivacyProfileCharacteristic" "PartyPrivacyProfileCharacteristic"[], "name" text, "agreementType" text, "agreementItem" "OneOfAgreementItem"[], "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "engagedParty" "OneOfPartyRefOrPartyRoleRef"[], "agreementPeriod" "TimePeriod", "completionDate" "TimePeriod", "description" text, "relatedDocument" "RelatedDocumentRefOrValue"[], "initialDate" timestamp(0) with time zone, "statementOfIntent" text, "status" text, "version" text, "agreementSpecification" "AgreementSpecificationRef", "agreementAuthorization" "AgreementAuthorization"[], "characteristic" "OneOfCharacteristic"[], "agreementRelationship" "AgreementRelationship"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A GeographicLocation is a pure-virtual super-class to the GeoJSON-aligned geometries of Point (addresses and locations), MultiPoint, LineString (streets, highways and boundaries), MultiLineString and Polygon (countries, provinces, tracts of land). Use the @type attribute to specify which of these is being specified by the geometry attribute.
CREATE TYPE "GeographicLocation" AS ("id" text, "href" text, "@type" text, "bbox" real[], "@baseType" text, "@schemaLocation" text);

-- An identification of an entity that is owned by or originates in a software system different from the current system, for example a ProductOrder handed off from a commerce platform into an order handling system. The structure identifies the system itself, the nature of the entity within the system (e.g. class name) and the unique ID of the entity within the system. It is anticipated that multiple external IDs can be held for a single entity, e.g. if the entity passed through multiple systems on the way to the current system. In this case the consumer is expected to sequence the IDs in the array in reverse order of provenance, i.e. most recent system first in the list.
CREATE TYPE "ExternalIdentifier" AS ("owner" text, "externalIdentifierType" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Base Extensible schema for use in TMForum Open-APIs - When used for in a schema it means that the Entity described by the schema  MUST be extended with the @type
CREATE TYPE "HourPeriod" AS ("endHour" text, "startHour" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Base Extensible schema for use in TMForum Open-APIs - When used for in a schema it means that the Entity described by the schema  MUST be extended with the @type
CREATE TYPE "CalendarPeriod" AS ("day" text, "timeZone" text, "hourPeriod" "HourPeriod"[], "status" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Base Extensible schema for use in TMForum Open-APIs - When used for in a schema it means that the Entity described by the schema  MUST be extended with the @type
CREATE TYPE "GeographicSiteRelationship" AS ("href" text, "role" text, "validFor" "TimePeriod", "id" text, "relationshipType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Place reference.
CREATE TYPE "GeographicSite" AS ("code" text, "creationDate" timestamp(0) with time zone, "description" text, "status" text, "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "externalIdentifier" "ExternalIdentifier"[], "calendar" "CalendarPeriod"[], "place" jsonb[], "siteRelationship" "GeographicSiteRelationship"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The corresponding identification of the resource in different standard, regulatory definitions. The standard specification identifier (e.g., ISO 3166-1 Alpha-2) and the corresponding value (e.g., BE) relevant to a particular resource. It is anticipated that multiple standards can provide definitions for a single entity, e.g., a country identifier can be specified in various standards (e.g., "ISO 3166-1 Alpha 2",  "ISO 3166-1 Alpha 3", "ISO 3166-1 Numeric")
CREATE TYPE "StandardIdentifier" AS ("format" text, "value" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Entity reference schema to be use for all entityRef class.
CREATE TYPE "GeographicLocationRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The polymorphic attributes @type, @schemaLocation & @referredType are related to the GeographicLocation entity and not the GeographicLocationRefOrValue class itself
CREATE TYPE "OneOfGeographicLocationRefOrValue" AS ("GeographicLocation" "GeographicLocation", "GeographicLocationRef" "GeographicLocationRef");

-- Representation of a SubUnit. It is used for describing subunit within a subAddress e.g. BERTH, FLAT, PIER, SUITE, SHOP, TOWER, UNIT, WHARF.
CREATE TYPE "GeographicSubAddressUnit" AS ("subUnitNumber" text, "subUnitType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Representation of a GeographicSubAddress 
-- It is used for addressing within a property in an urban area (country properties are often defined differently). It may refer to a building, a building cluster, or a floor of a multistory building.
CREATE TYPE "GeographicSubAddress" AS ("buildingName" text, "href" text, "id" text, "levelNumber" text, "levelType" text, "name" text, "privateStreetName" text, "privateStreetNumber" text, "subUnit" "GeographicSubAddressUnit"[], "subAddressType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Structured textual way of describing how to find a Property in an urban area (country properties are often defined differently).
-- Note : Address corresponds to SID UrbanPropertyAddress
CREATE TYPE "GeographicAddress" AS ("city" text, "country" text, "locality" text, "postcode" text, "stateOrProvince" text, "streetName" text, "streetNr" text, "streetNrLast" text, "streetNrLastSuffix" text, "streetNrSuffix" text, "streetSuffix" text, "streetType" text, "countryCode" "StandardIdentifier"[], "externalIdentifier" "ExternalIdentifier"[], "geographicLocation" "OneOfGeographicLocationRefOrValue", "geographicSubAddress" "GeographicSubAddress"[], "geographicAddressType" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Place reference.
CREATE TYPE "PlaceRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The polymorphic attributes @type, @schemaLocation & @referredType are related to the Place entity and not the PlaceRefOrValue class itself
CREATE TYPE "OneOfPlaceRefOrValue" AS ("GeographicLocation" "GeographicLocation", "GeographicSite" "GeographicSite", "GeographicAddress" "GeographicAddress", "PlaceRef" "PlaceRef");

-- Entity reference. The polymorphic attributes @type, @schemaLocation & @referredType are related to the RelatedPlace entity and not the RelatedPlaceRefOrValue class itself
CREATE TYPE "RelatedPlaceRefOrValue" AS ("role" text, "place" "OneOfPlaceRefOrValue", "@type" text, "@baseType" text, "@schemaLocation" text);

-- Resource reference, for when Resource is used by other entities.
CREATE TYPE "ResourceRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Service reference, for when Service is used by other entities.
CREATE TYPE "ServiceRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Extra information about a given entity
CREATE TYPE "Note" AS ("id" text, "author" text, "date" timestamp(0) with time zone, "text" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Define the patterns of impact (optional), such as other service characteristics- Used when defining impact through another pattern than the pre-defined attributes
CREATE TYPE "ImpactPattern" AS ("description" text, "characteristic" "OneOfCharacteristic"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Entity reference schema to be use for all entityRef class.
CREATE TYPE "ServiceProblemRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Events linked with service problem
CREATE TYPE "EventRef" AS ("id" text, "href" text, "eventTime" timestamp(0) with time zone, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Possible values for the state of the ServiceProblem
CREATE TYPE "ServiceProblemStateType" AS ENUM ('acknowledged', 'rejected', 'pending', 'held', 'inProgress', 'resolved', 'cancelled', 'closed');

-- Tracking records allow the tracking of modifications on the problem. The tracking records should not be embedded in the problem to allow retrieving the problem without the tracking records
CREATE TYPE "TrackingRecord" AS ("description" text, "characteristic" "OneOfCharacteristic"[], "systemId" text, "time" timestamp(0) with time zone, "user" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A set of alarm ids identifying the alarms that are underlying this problem.
CREATE TYPE "ResourceAlarmRef" AS ("changeRequest" "EntityRef", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text, "name" text, "@referredType" text);

-- Entity reference schema to be use for all entityRef class.
CREATE TYPE "SLAViolationRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- reference to an TroubleTicket object
CREATE TYPE "TroubleTicketRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- represents an Error
CREATE TYPE "ErrorMessage" AS ("code" text, "reason" text, "message" text, "status" text, "referenceError" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The problem information for Middle B which is abstracted in the service layer from the issued event information by First B
CREATE TYPE "ServiceProblem" AS ("affectedLocation" "RelatedPlaceRefOrValue"[], "affectedNumberOfServices" integer, "affectedResource" "ResourceRef"[], "affectedService" "ServiceRef"[], "note" "Note"[], "externalIdentifier" "ExternalIdentifier"[], "name" text, "characteristic" "OneOfCharacteristic"[], "firstAlert" "RelatedEntity", "impactImportanceFactor" text, "impactPattern" "ImpactPattern", "originatingSystem" text, "parentProblem" "ServiceProblemRef"[], "problemEscalation" text, "relatedEvent" "EventRef"[], "relatedEntity" "RelatedEntity"[], "responsibleParty" "RelatedPartyRefOrPartyRoleRef", "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "rootCauseResource" "ResourceRef"[], "rootCauseService" "ServiceRef"[], "resolutionDate" timestamp(0) with time zone, "status" "ServiceProblemStateType", "statusChangeDate" timestamp(0) with time zone, "statusChangeReason" text, "lastUpdate" timestamp(0) with time zone, "creationDate" timestamp(0) with time zone, "trackingRecord" "TrackingRecord"[], "underlyingAlarm" "ResourceAlarmRef"[], "slaViolation" "SLAViolationRef"[], "troubleTicket" "TroubleTicketRef"[], "underlyingProblem" "ServiceProblemRef"[], "errorMessage" "ErrorMessage"[], "category" text, "description" text, "priority" integer, "reason" text, "originatorParty" "RelatedPartyRefOrPartyRoleRef", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The problem information for Middle B which is abstracted in the service layer from the issued event information by First B
CREATE TABLE "serviceProblem" ("affectedLocation" "RelatedPlaceRefOrValue"[], "affectedNumberOfServices" integer, "affectedResource" "ResourceRef"[], "affectedService" "ServiceRef"[], "note" "Note"[], "externalIdentifier" "ExternalIdentifier"[], "name" text, "characteristic" "OneOfCharacteristic"[], "firstAlert" "RelatedEntity", "impactImportanceFactor" text, "impactPattern" "ImpactPattern", "originatingSystem" text, "parentProblem" "ServiceProblemRef"[], "problemEscalation" text, "relatedEvent" "EventRef"[], "relatedEntity" "RelatedEntity"[], "responsibleParty" "RelatedPartyRefOrPartyRoleRef", "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "rootCauseResource" "ResourceRef"[], "rootCauseService" "ServiceRef"[], "resolutionDate" timestamp(0) with time zone, "status" "ServiceProblemStateType", "statusChangeDate" timestamp(0) with time zone, "statusChangeReason" text, "lastUpdate" timestamp(0) with time zone, "creationDate" timestamp(0) with time zone, "trackingRecord" "TrackingRecord"[], "underlyingAlarm" "ResourceAlarmRef"[], "slaViolation" "SLAViolationRef"[], "troubleTicket" "TroubleTicketRef"[], "underlyingProblem" "ServiceProblemRef"[], "errorMessage" "ErrorMessage"[], "category" text, "description" text, "priority" integer, "reason" text, "originatorParty" "RelatedPartyRefOrPartyRoleRef", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Base Extensible schema for use in TMForum Open-APIs - When used for in a schema it means that the Entity described by the schema  MUST be extended with the @type
CREATE TYPE "Any" AS ("@type" text, "@baseType" text, "@schemaLocation" text);

-- A record of an event (related to a service problem) received from another system
CREATE TYPE "ServiceProblemEventRecord" AS ("eventTime" timestamp(0) with time zone, "eventType" text, "recordTime" timestamp(0) with time zone, "serviceProblem" "ServiceProblemRef", "notification" "Any", "href" text, "id" text);

-- A record of an event (related to a service problem) received from another system
CREATE TABLE "serviceProblemEventRecord" ("eventTime" timestamp(0) with time zone, "eventType" text, "recordTime" timestamp(0) with time zone, "serviceProblem" "ServiceProblemRef", "notification" "Any", "href" text, "id" text);

-- Task resource that requests acknowledgement of problems by the problem handler.
CREATE TYPE "ProblemAcknowledgement" AS ("ackProblem" "ServiceProblemRef"[], "trackingRecord" "TrackingRecord", "problem" "ServiceProblemRef"[], "state" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Task resource that requests acknowledgement of problems by the problem handler.
CREATE TABLE "problemAcknowledgement" ("ackProblem" "ServiceProblemRef"[], "trackingRecord" "TrackingRecord", "problem" "ServiceProblemRef"[], "state" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Task resource that requests unacknowledgement of problems, rolling back the status of the problems from Acknowledged to Submitted.
CREATE TYPE "ProblemUnacknowledgement" AS ("unackProblem" "ServiceProblemRef"[], "trackingRecord" "TrackingRecord", "problem" "ServiceProblemRef"[], "state" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Task resource that requests unacknowledgement of problems, rolling back the status of the problems from Acknowledged to Submitted.
CREATE TABLE "problemUnacknowledgement" ("unackProblem" "ServiceProblemRef"[], "trackingRecord" "TrackingRecord", "problem" "ServiceProblemRef"[], "state" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Task resource that requests Service Problems to be grouped together into a parent and set of children
CREATE TYPE "ProblemGroup" AS ("childProblem" "ServiceProblemRef"[], "parentProblem" "ServiceProblemRef", "state" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Task resource that requests Service Problems to be grouped together into a parent and set of children
CREATE TABLE "problemGroup" ("childProblem" "ServiceProblemRef"[], "parentProblem" "ServiceProblemRef", "state" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Task resource that requests Service Problems to be ungrouped from a parent
CREATE TYPE "ProblemUngroup" AS ("childProblem" "ServiceProblemRef"[], "parentProblem" "ServiceProblemRef", "state" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Task resource that requests Service Problems to be ungrouped from a parent
CREATE TABLE "problemUngroup" ("childProblem" "ServiceProblemRef"[], "parentProblem" "ServiceProblemRef", "state" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A collection of Product Offerings, intended for a specific DistributionChannel, enhanced with additional information such as SLA parameters, invoicing and shipping details
CREATE TYPE "ProductCatalog" AS ("category" "CategoryRef"[], "description" text, "catalogType" text, "validFor" "TimePeriod", "version" text, "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "lastUpdate" timestamp(0) with time zone, "lifecycleStatus" text, "name" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A collection of Product Offerings, intended for a specific DistributionChannel, enhanced with additional information such as SLA parameters, invoicing and shipping details
CREATE TABLE "productCatalog" ("category" "CategoryRef"[], "description" text, "catalogType" text, "validFor" "TimePeriod", "version" text, "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "lastUpdate" timestamp(0) with time zone, "lifecycleStatus" text, "name" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A set of numbers that specifies the lower and upper limits for a ProductOffering that can be procured as part of the related BundledProductOffering. Values can range from 0 to unbounded
CREATE TYPE "BundledProductOfferingOption" AS ("numberRelOfferDefault" integer, "numberRelOfferLowerLimit" integer, "numberRelOfferUpperLimit" integer, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Represents a containment of a product offering within another product offering, including specification of cardinality (e.g. is the bundled offering mandatory, how many times can it be instantiated in the parent product, etc.).
CREATE TYPE "BundledProductOffering" AS ("bundledProductOfferingOption" "BundledProductOfferingOption", "version" text, "id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- ProductOffering reference. A product offering represents entities that are orderable from the provider of the catalog, this resource includes pricing information.
CREATE TYPE "OneOfProductOfferingRef" AS ("ProductOfferingRef" "ProductOfferingRef", "BundledProductOffering" "BundledProductOffering");

-- The category resource is used to group product offerings, service and resource candidates in logical containers. Categories can contain other categories and/or product offerings, resource or service candidates.
CREATE TYPE "Category" AS ("description" text, "isRoot" boolean, "parent" "CategoryRef", "productOffering" "OneOfProductOfferingRef"[], "subCategory" "CategoryRef"[], "validFor" "TimePeriod", "version" text, "lastUpdate" timestamp(0) with time zone, "lifecycleStatus" text, "name" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The category resource is used to group product offerings, service and resource candidates in logical containers. Categories can contain other categories and/or product offerings, resource or service candidates.
CREATE TABLE "category" ("description" text, "isRoot" boolean, "parent" "CategoryRef", "productOffering" "OneOfProductOfferingRef"[], "subCategory" "CategoryRef"[], "validFor" "TimePeriod", "version" text, "lastUpdate" timestamp(0) with time zone, "lifecycleStatus" text, "name" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- ServiceLevelAgreement reference: A service level agreement (SLA) is a type of agreement that represents a formal negotiated agreement between two parties designed to create a common understanding about products, services, priorities, responsibilities, and so forth. The SLA is a set of appropriate procedures and targets formally or informally agreed between parties in order to achieve and maintain specified Quality of Service.
CREATE TYPE "SLARef" AS ("href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text, "name" text, "@referredType" text);

-- The channel to which the resource reference to. e.g. channel for selling product offerings, channel for opening a trouble ticket etc..
CREATE TYPE "ChannelRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- ServiceCandidate reference. ServiceCandidate is an entity that makes a ServiceSpecification available to a catalog.
CREATE TYPE "ServiceCandidateRef" AS ("version" text, "id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- ResourceCandidate is an entity that makes a resource specification available to a catalog. A ResourceCandidate and its associated resource specification may be published - made visible - in any number of resource catalogs, or in none.
CREATE TYPE "ResourceCandidateRef" AS ("version" text, "id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A time interval in a given unit of time
CREATE TYPE "Duration" AS ("amount" integer, "units" text);

-- A condition under which a ProductOffering is made available to Customers. For instance, a productOffering can be offered with multiple commitment periods.
CREATE TYPE "ProductOfferingTerm" AS ("description" text, "duration" "Duration", "name" text, "validFor" "TimePeriod", "@type" text, "@baseType" text, "@schemaLocation" text);

-- A base / value business entity used to represent money
CREATE TYPE "Money" AS ("unit" text, "value" real);

-- This represents a bundling pricing relationship, allowing a price to be composed of multiple other prices (e.g. a recurring charge and a onetime charge).
CREATE TYPE "BundledProductOfferingPriceRelationship" AS ("version" text, "id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Describes a non-composite relationship between product offering prices. For example one price might be an discount alteration for another price.
CREATE TYPE "ProductOfferingPriceRelationship" AS ("role" text, "relationshipType" text, "version" text, "id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The reference object to the schema and type of target product which is described by product specification
CREATE TYPE "TargetProductSchema" AS ("@type" text, "@schemaLocation" text);

-- ProductSpecification reference. A product Specification represents entities that are orderable from the provider of the catalog.
CREATE TYPE "ProductSpecificationRef" AS ("version" text, "targetProductSchema" "TargetProductSchema", "id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A use of the ProductSpecificationCharacteristicValue by a ProductOffering to which additional properties (attributes) apply or override the properties of similar properties contained in ProductSpecificationCharacteristicValue. It should be noted that characteristics which their value(s) addressed by this object must exist in corresponding product specification. The available characteristic values for a ProductSpecificationCharacteristic in a Product specification can be modified at the ProductOffering level. For example, a characteristic 'Color' might have values White, Blue, Green, and Red. But, the list of values can be restricted to e.g. White and Blue in an associated product offering. It should be noted that the list of values in 'ProductSpecificationCharacteristicValueUse' is a strict subset of the list of values as defined in the corresponding product specification characteristics.
CREATE TYPE "ProductSpecificationCharacteristicValueUse" AS ("name" text, "id" text, "description" text, "valueType" text, "minCardinality" integer, "maxCardinality" integer, "validFor" "TimePeriod", "productSpecCharacteristicValue" "OneOfCharacteristicValueSpecification"[], "productSpecification" "ProductSpecificationRef", "@type" text, "@baseType" text, "@schemaLocation" text);

-- Reference to managed Policy object
CREATE TYPE "PolicyRef" AS ("id" text, "href" text, "version" text, "@type" text, "@baseType" text, "@schemaLocation" text, "name" text, "@referredType" text);

-- The PricingLogicAlgorithm entity represents an instantiation of an interface specification to external rating function (without a modeled bahavior in SID). Some of the parameters of the interface definiition may be already set (such as price per unit) and some may be gathered during the rating process from the event (such as call duration) or from ProductCharacteristicValues (such as assigned bandwidth)
CREATE TYPE "PricingLogicAlgorithm" AS ("description" text, "name" text, "plaSpecId" text, "validFor" "TimePeriod", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A tax item is created for each tax rate and tax type used in the bill.
CREATE TYPE "TaxItem" AS ("taxAmount" "Money", "taxCategory" text, "taxRate" real, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Is based on both the basic cost to develop and produce products and the enterprises policy on revenue targets. This price may be further revised through discounting (a Product Offering Price that reflects an alteration). The price, applied for a productOffering may also be influenced by the productOfferingTerm, the customer selected, eg: a productOffering can be offered with multiple terms, like commitment periods for the contract. The price may be influenced by this productOfferingTerm. A productOffering may be cheaper with a 24 month commitment than with a 12 month commitment.
CREATE TYPE "ProductOfferingPrice" AS ("description" text, "version" text, "validFor" "TimePeriod", "unitOfMeasure" "Quantity", "recurringChargePeriodType" text, "recurringChargePeriodLength" integer, "isBundle" boolean, "price" "Money", "percentage" real, "bundledPopRelationship" "BundledProductOfferingPriceRelationship"[], "popRelationship" "ProductOfferingPriceRelationship"[], "prodSpecCharValueUse" "ProductSpecificationCharacteristicValueUse"[], "productOfferingTerm" "ProductOfferingTerm"[], "place" "PlaceRef"[], "policy" "PolicyRef"[], "pricingLogicAlgorithm" "PricingLogicAlgorithm"[], "tax" "TaxItem"[], "name" text, "priceType" text, "lastUpdate" timestamp(0) with time zone, "lifecycleStatus" text, "externalIdentifier" "ExternalIdentifier"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- ProductPriceOffering reference. An amount, usually of money, that is asked for or allowed when a ProductOffering is bought, rented, or leased
CREATE TYPE "ProductOfferingPriceRef" AS ("version" text, "id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The polymorphic attributes @type, @schemaLocation & @referredType are related to the ProductOfferingPrice entity and not the ProductOfferingPriceRefOrValue class itself
CREATE TYPE "OneOfProductOfferingPriceRefOrValue" AS ("ProductOfferingPrice" "ProductOfferingPrice", "ProductOfferingPriceRef" "ProductOfferingPriceRef");

-- Agreement reference. An agreement represents a contract or arrangement, either written or verbal and sometimes enforceable by law, such as a service level agreement or a customer price agreement. An agreement involves a number of other business entities, such as products, services, and resources and/or their specifications.
CREATE TYPE "AgreementRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Defines for a BundledProductOfferingGroup (i.e. a group of multiple child offerings of a parent product offering), how many instances from the child offerings can be chosen in total. For example facilitate the choice of between 2 and 7 channel packs from a list, and cause certain items to be selected by default
CREATE TYPE "BundledGroupProductOfferingOption" AS ("numberRelOfferLowerLimit" integer, "numberRelOfferUpperLimit" integer, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A group of product offerings that can be chosen for instantiation of children of the parent product offering, for example a list of channels for selection under a TV offering. Sometimes known as Selection Group. The group can also hierarchically contain other groups
CREATE TYPE "BundledGroupProductOffering" AS ("id" text, "name" text, "bundledProductOffering" "BundledProductOffering"[], "bundledGroupProductOffering" jsonb[], "bundledGroupProductOfferingOption" "BundledGroupProductOfferingOption", "@type" text, "@baseType" text, "@schemaLocation" text);

-- provides references to the corresponding market segment as target of product offerings. A market segment is grouping of Parties, GeographicAreas, SalesChannels, and so forth.
CREATE TYPE "MarketSegmentRef" AS ("href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text, "name" text, "@referredType" text);

-- A relationship between two product Offerings.
CREATE TYPE "ProductOfferingRelationship" AS ("role" text, "name" text, "validFor" "TimePeriod", "relationshipType" text, "version" text, "id" text, "href" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- This class defines a characteristic specification.
CREATE TYPE "CharacteristicSpecification" AS ("id" text, "name" text, "valueType" text, "description" text, "configurable" boolean, "validFor" "TimePeriod", "minCardinality" integer, "maxCardinality" integer, "isUnique" boolean, "regex" text, "extensible" boolean, "@valueSchemaLocation" text, "charSpecRelationship" "CharacteristicSpecificationRelationship"[], "characteristicValueSpecification" "OneOfCharacteristicValueSpecification"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- Defines an action that can be taken on a product in the inventory as part of a product order. It is expected that this entity will be attached to product catalog items such as specifications and offerings
CREATE TYPE "AllowedProductAction" AS ("validFor" "TimePeriod", "channel" "ChannelRef"[], "action" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Represents entities that are orderable from the provider of the catalog, this resource includes pricing information.
CREATE TYPE "ProductOffering" AS ("description" text, "isBundle" boolean, "isSellable" boolean, "statusReason" text, "validFor" "TimePeriod", "version" text, "place" "PlaceRef"[], "serviceLevelAgreement" "SLARef", "channel" "ChannelRef"[], "serviceCandidate" "ServiceCandidateRef", "category" "CategoryRef"[], "resourceCandidate" "ResourceCandidateRef", "productOfferingTerm" "ProductOfferingTerm"[], "productOfferingPrice" "OneOfProductOfferingPriceRefOrValue"[], "agreement" "AgreementRef"[], "bundledProductOffering" "BundledProductOffering"[], "bundledGroupProductOffering" "BundledGroupProductOffering"[], "attachment" "OneOfAttachmentRefOrValue"[], "marketSegment" "MarketSegmentRef"[], "productOfferingRelationship" "ProductOfferingRelationship"[], "productOfferingCharacteristic" "CharacteristicSpecification"[], "prodSpecCharValueUse" "ProductSpecificationCharacteristicValueUse"[], "policy" "PolicyRef"[], "allowedAction" "AllowedProductAction"[], "lastUpdate" timestamp(0) with time zone, "lifecycleStatus" text, "name" text, "productSpecification" "ProductSpecificationRef", "externalIdentifier" "ExternalIdentifier"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Represents entities that are orderable from the provider of the catalog, this resource includes pricing information.
CREATE TABLE "productOffering" ("description" text, "isBundle" boolean, "isSellable" boolean, "statusReason" text, "validFor" "TimePeriod", "version" text, "place" "PlaceRef"[], "serviceLevelAgreement" "SLARef", "channel" "ChannelRef"[], "serviceCandidate" "ServiceCandidateRef", "category" "CategoryRef"[], "resourceCandidate" "ResourceCandidateRef", "productOfferingTerm" "ProductOfferingTerm"[], "productOfferingPrice" "OneOfProductOfferingPriceRefOrValue"[], "agreement" "AgreementRef"[], "bundledProductOffering" "BundledProductOffering"[], "bundledGroupProductOffering" "BundledGroupProductOffering"[], "attachment" "OneOfAttachmentRefOrValue"[], "marketSegment" "MarketSegmentRef"[], "productOfferingRelationship" "ProductOfferingRelationship"[], "productOfferingCharacteristic" "CharacteristicSpecification"[], "prodSpecCharValueUse" "ProductSpecificationCharacteristicValueUse"[], "policy" "PolicyRef"[], "allowedAction" "AllowedProductAction"[], "lastUpdate" timestamp(0) with time zone, "lifecycleStatus" text, "name" text, "productSpecification" "ProductSpecificationRef", "externalIdentifier" "ExternalIdentifier"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Is based on both the basic cost to develop and produce products and the enterprises policy on revenue targets. This price may be further revised through discounting (a Product Offering Price that reflects an alteration). The price, applied for a productOffering may also be influenced by the productOfferingTerm, the customer selected, eg: a productOffering can be offered with multiple terms, like commitment periods for the contract. The price may be influenced by this productOfferingTerm. A productOffering may be cheaper with a 24 month commitment than with a 12 month commitment.
CREATE TABLE "productOfferingPrice" ("description" text, "version" text, "validFor" "TimePeriod", "unitOfMeasure" "Quantity", "recurringChargePeriodType" text, "recurringChargePeriodLength" integer, "isBundle" boolean, "price" "Money", "percentage" real, "bundledPopRelationship" "BundledProductOfferingPriceRelationship"[], "popRelationship" "ProductOfferingPriceRelationship"[], "prodSpecCharValueUse" "ProductSpecificationCharacteristicValueUse"[], "productOfferingTerm" "ProductOfferingTerm"[], "place" "PlaceRef"[], "policy" "PolicyRef"[], "pricingLogicAlgorithm" "PricingLogicAlgorithm"[], "tax" "TaxItem"[], "name" text, "priceType" text, "lastUpdate" timestamp(0) with time zone, "lifecycleStatus" text, "externalIdentifier" "ExternalIdentifier"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Service specification reference: ServiceSpecification(s) required to realize a ProductSpecification.
CREATE TYPE "ServiceSpecificationRef" AS ("version" text, "id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A type of ProductSpecification that belongs to a grouping of ProductSpecifications made available to the market. It inherits of all attributes of ProductSpecification.
CREATE TYPE "BundledProductSpecification" AS ("href" text, "id" text, "lifecycleStatus" text, "name" text, "version" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A migration, substitution, dependency or exclusivity relationship between/among product specifications.
CREATE TYPE "ProductSpecificationRelationship" AS ("characteristic" "CharacteristicSpecification"[], "validFor" "TimePeriod", "relationshipType" text, "version" text, "id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Resources are physical or non-physical components (or some combination of these) within an enterprise's infrastructure or inventory. They are typically consumed or used by services (for example a physical port assigned to a service) or contribute to the realization of a Product (for example, a SIM card). They can be drawn from the Application, Computing and Network domains, and include, for example, Network Elements, software, IT systems, content and information, and technology components.
-- A ResourceSpecification is an abstract base class for representing a generic means for implementing a particular type of Resource. In essence, a ResourceSpecification defines the common attributes and relationships of a set of related Resources, while Resource defines a specific instance that is based on a particular ResourceSpecification.
CREATE TYPE "ResourceSpecificationRef" AS ("version" text, "id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Entity reference schema to be use for all entityRef class.
CREATE TYPE "IntentSpecificationRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Is a detailed description of a tangible or intangible object made available externally in the form of a ProductOffering to customers or other parties playing a party role.
CREATE TYPE "ProductSpecification" AS ("brand" text, "description" text, "isBundle" boolean, "productNumber" text, "category" "CategoryRef"[], "validFor" "TimePeriod", "version" text, "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "productSpecCharacteristic" "CharacteristicSpecification"[], "serviceSpecification" "ServiceSpecificationRef"[], "bundledProductSpecification" "BundledProductSpecification"[], "productSpecificationRelationship" "ProductSpecificationRelationship"[], "resourceSpecification" "ResourceSpecificationRef"[], "attachment" "OneOfAttachmentRefOrValue"[], "policy" "PolicyRef"[], "targetProductSchema" "TargetProductSchema", "intentSpecification" "IntentSpecificationRef", "lastUpdate" timestamp(0) with time zone, "lifecycleStatus" text, "name" text, "externalIdentifier" "ExternalIdentifier"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Is a detailed description of a tangible or intangible object made available externally in the form of a ProductOffering to customers or other parties playing a party role.
CREATE TABLE "productSpecification" ("brand" text, "description" text, "isBundle" boolean, "productNumber" text, "category" "CategoryRef"[], "validFor" "TimePeriod", "version" text, "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "productSpecCharacteristic" "CharacteristicSpecification"[], "serviceSpecification" "ServiceSpecificationRef"[], "bundledProductSpecification" "BundledProductSpecification"[], "productSpecificationRelationship" "ProductSpecificationRelationship"[], "resourceSpecification" "ResourceSpecificationRef"[], "attachment" "OneOfAttachmentRefOrValue"[], "policy" "PolicyRef"[], "targetProductSchema" "TargetProductSchema", "intentSpecification" "IntentSpecificationRef", "lastUpdate" timestamp(0) with time zone, "lifecycleStatus" text, "name" text, "externalIdentifier" "ExternalIdentifier"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Possible values for the status of the trouble ticket
CREATE TYPE "TroubleTicketStatusType" AS ENUM ('acknowledged', 'rejected', 'pending', 'held', 'inProgress', 'cancelled', 'closed', 'resolved');

-- Holds the status, reasons and associated date the status changed, populated by the server
CREATE TYPE "StatusChange" AS ("statusChangeDate" timestamp(0) with time zone, "statusChangeReason" text, "status" "TroubleTicketStatusType", "@type" text, "@baseType" text, "@schemaLocation" text);

-- Represents a relationship between trouble tickets
CREATE TYPE "TroubleTicketRelationship" AS ("id" text, "name" text, "relationshipType" text, "href" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- reference to an TroubleTicketSpecification object
CREATE TYPE "TroubleTicketSpecificationRef" AS ("version" text, "id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A trouble ticket is a record of an issue that is created, tracked, and managed by a trouble ticket management system
CREATE TYPE "TroubleTicket" AS ("name" text, "description" text, "severity" text, "ticketType" text, "attachment" "OneOfAttachmentRefOrValue"[], "channel" "ChannelRef", "creationDate" timestamp(0) with time zone, "requestedResolutionDate" timestamp(0) with time zone, "expectedResolutionDate" timestamp(0) with time zone, "resolutionDate" timestamp(0) with time zone, "externalIdentifier" "ExternalIdentifier"[], "lastUpdate" timestamp(0) with time zone, "note" "Note"[], "priority" text, "relatedEntity" "RelatedEntity"[], "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "status" "TroubleTicketStatusType", "statusChangeDate" timestamp(0) with time zone, "statusChangeReason" text, "statusChangeHistory" "StatusChange"[], "troubleTicketRelationship" "TroubleTicketRelationship"[], "troubleTicketSpecification" "TroubleTicketSpecificationRef", "troubleTicketCharacteristic" "OneOfCharacteristic"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A trouble ticket is a record of an issue that is created, tracked, and managed by a trouble ticket management system
CREATE TABLE "troubleTicket" ("name" text, "description" text, "severity" text, "ticketType" text, "attachment" "OneOfAttachmentRefOrValue"[], "channel" "ChannelRef", "creationDate" timestamp(0) with time zone, "requestedResolutionDate" timestamp(0) with time zone, "expectedResolutionDate" timestamp(0) with time zone, "resolutionDate" timestamp(0) with time zone, "externalIdentifier" "ExternalIdentifier"[], "lastUpdate" timestamp(0) with time zone, "note" "Note"[], "priority" text, "relatedEntity" "RelatedEntity"[], "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "status" "TroubleTicketStatusType", "statusChangeDate" timestamp(0) with time zone, "statusChangeReason" text, "statusChangeHistory" "StatusChange"[], "troubleTicketRelationship" "TroubleTicketRelationship"[], "troubleTicketSpecification" "TroubleTicketSpecificationRef", "troubleTicketCharacteristic" "OneOfCharacteristic"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- TroubleTicketSpecification defines the common attributes and relationships of a set of related trouble tickets, while trouble ticket defines a specific instance that is based on a particular trouble ticket specification.
CREATE TYPE "TroubleTicketSpecification" AS ("name" text, "description" text, "lifecycleStatus" text, "specCharacteristic" "CharacteristicSpecification"[], "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "validFor" "TimePeriod", "version" text, "creationDate" timestamp(0) with time zone, "lastUpdate" timestamp(0) with time zone, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- TroubleTicketSpecification defines the common attributes and relationships of a set of related trouble tickets, while trouble ticket defines a specific instance that is based on a particular trouble ticket specification.
CREATE TABLE "troubleTicketSpecification" ("name" text, "description" text, "lifecycleStatus" text, "specCharacteristic" "CharacteristicSpecification"[], "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "validFor" "TimePeriod", "version" text, "creationDate" timestamp(0) with time zone, "lastUpdate" timestamp(0) with time zone, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Recommended Enumeration Type (not formal forced in standard): Valid values for 'CustomerBillOnDemand': 'inProgress', 'rejected', 'done', 'terminatedWithError'
CREATE TYPE "CustomerBillOnDemandStateType" AS ENUM ('inProgress', 'rejected', 'done', 'terminatedWithError');

-- BillingAccount reference. A BillingAccount is a detailed description of a bill structure.
CREATE TYPE "BillingAccountRef" AS ("ratingType" text, "id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Bill reference.
CREATE TYPE "CustomerBillRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- This resource is used to manage the creation request of a customer bill in real-time (on demand).
CREATE TYPE "CustomerBillOnDemand" AS ("name" text, "state" "CustomerBillOnDemandStateType", "billingAccount" "BillingAccountRef", "customerBill" "CustomerBillRef", "description" text, "lastUpdate" text, "relatedParty" "RelatedPartyRefOrPartyRoleRef", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- This resource is used to manage the creation request of a customer bill in real-time (on demand).
CREATE TABLE "customerBillOnDemand" ("name" text, "state" "CustomerBillOnDemandStateType", "billingAccount" "BillingAccountRef", "customerBill" "CustomerBillRef", "description" text, "lastUpdate" text, "relatedParty" "RelatedPartyRefOrPartyRoleRef", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- If an immediate payment has been done at the product order submission, the payment information are captured and stored (as a reference) in the order.
CREATE TYPE "PaymentRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The applied payment is the result of lettering process. It enables to assign automatically or manually part of incoming payment amount to a bill.
CREATE TYPE "AppliedPayment" AS ("appliedAmount" "Money", "payment" "PaymentRef");

-- ....
CREATE TYPE "BillCycleRef" AS ("@referredType" text, "id" text, "href" text, "name" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- AccountReceivable reference. An account of money owed by a party to another entity in exchange for goods or services that have been delivered or used. An account receivable aggregates the amounts of one or more party accounts (billing or settlement) owned by a given party.
CREATE TYPE "FinancialAccountRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- PaymentMethod reference. A payment method defines a specific mean of payment (e.g direct debit).
CREATE TYPE "PaymentMethodRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Recommended Enumeration Type (not formal forced in standard): Valid values for the runType of a bill. The bill could be produced in a regular bill cycle 'onCycle'. Otherwise the bill is produced on a request (e.g. customer request). This could be indicated by 'offCycle'
CREATE TYPE "CustomerBillRunType" AS ENUM ('onCycle', 'offCycle');

-- Recommended Enumeration Type (not formal forced in standard): Valid values for the lifecycle state of the bill: new = 'bill is ready to validate or to sent', validated = 'bill is checked (manual / automatic)', sent = 'bill is sent with the channel defined in the billingaccount', settled = 'bill is payed', partiallySettled = 'bill is partially payed', onHold = 'bill will not be in further processing until open issues connected to the bill are solved'
CREATE TYPE "CustomerBillStateType" AS ENUM ('new', 'onHold', 'validated', 'sent', 'settled', 'partiallyPaid');

-- The customer bill. Can be a regular recurring bill or an extra bill on demand by the customer or the csp.
CREATE TYPE "CustomerBill" AS ("amountDue" "Money", "appliedPayment" "AppliedPayment"[], "billDate" timestamp(0) with time zone, "billDocument" "OneOfAttachmentRefOrValue"[], "billNo" text, "billingAccount" "BillingAccountRef", "billingPeriod" "TimePeriod", "billCycle" "BillCycleRef", "category" text, "financialAccount" "FinancialAccountRef", "lastUpdate" timestamp(0) with time zone, "nextBillDate" timestamp(0) with time zone, "paymentDueDate" timestamp(0) with time zone, "paymentMethod" "PaymentMethodRef", "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "remainingAmount" "Money", "runType" "CustomerBillRunType", "taxExcludedAmount" "Money", "taxIncludedAmount" "Money", "taxItem" "TaxItem"[], "state" "CustomerBillStateType", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The customer bill. Can be a regular recurring bill or an extra bill on demand by the customer or the csp.
CREATE TABLE "customerBill" ("amountDue" "Money", "appliedPayment" "AppliedPayment"[], "billDate" timestamp(0) with time zone, "billDocument" "OneOfAttachmentRefOrValue"[], "billNo" text, "billingAccount" "BillingAccountRef", "billingPeriod" "TimePeriod", "billCycle" "BillCycleRef", "category" text, "financialAccount" "FinancialAccountRef", "lastUpdate" timestamp(0) with time zone, "nextBillDate" timestamp(0) with time zone, "paymentDueDate" timestamp(0) with time zone, "paymentMethod" "PaymentMethodRef", "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "remainingAmount" "Money", "runType" "CustomerBillRunType", "taxExcludedAmount" "Money", "taxIncludedAmount" "Money", "taxItem" "TaxItem"[], "state" "CustomerBillStateType", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The applied billing tax rate represents taxes applied billing rate it refers to. It is calculated during the billing process.
CREATE TYPE "AppliedBillingTaxRate" AS ("taxAmount" "Money", "taxCategory" text, "taxRate" real, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A customer bill displays applied billing rates created before or during the billing process.
CREATE TYPE "AppliedCustomerBillingRate" AS ("appliedTax" "AppliedBillingTaxRate"[], "bill" "CustomerBillRef", "date" timestamp(0) with time zone, "description" text, "isBilled" boolean, "name" text, "periodCoverage" "TimePeriod", "taxExcludedAmount" "Money", "taxIncludedAmount" "Money", "appliedBillingRateType" text, "billingAccount" "BillingAccountRef", "product" "ProductRef", "characteristic" "OneOfCharacteristic"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A customer bill displays applied billing rates created before or during the billing process.
CREATE TABLE "appliedCustomerBillingRate" ("appliedTax" "AppliedBillingTaxRate"[], "bill" "CustomerBillRef", "date" timestamp(0) with time zone, "description" text, "isBilled" boolean, "name" text, "periodCoverage" "TimePeriod", "taxExcludedAmount" "Money", "taxIncludedAmount" "Money", "appliedBillingRateType" text, "billingAccount" "BillingAccountRef", "product" "ProductRef", "characteristic" "OneOfCharacteristic"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Refers an BillCycleSpecification
CREATE TYPE "BillCycleSpecificationRef" AS ("description" text, "id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A detailed description of a billing cycle and the various sub steps of a billing cycle.
CREATE TYPE "BillCycle" AS ("billingDate" timestamp(0) with time zone, "billingPeriod" text, "chargeDate" timestamp(0) with time zone, "creditDate" timestamp(0) with time zone, "description" text, "mailingDate" timestamp(0) with time zone, "name" text, "paymentDueDate" timestamp(0) with time zone, "BillCycleSpecification" "BillCycleSpecificationRef", "validFor" "TimePeriod", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A detailed description of a billing cycle and the various sub steps of a billing cycle.
CREATE TABLE "billCycle" ("billingDate" timestamp(0) with time zone, "billingPeriod" text, "chargeDate" timestamp(0) with time zone, "creditDate" timestamp(0) with time zone, "description" text, "mailingDate" timestamp(0) with time zone, "name" text, "paymentDueDate" timestamp(0) with time zone, "BillCycleSpecification" "BillCycleSpecificationRef", "validFor" "TimePeriod", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- It's a Agreement item that has been executed previously.
CREATE TYPE "AgreementItemRef" AS ("agreementName" text, "agreementHref" text, "@referredType" text, "agreementId" text, "agreementItemId" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- action to be performed on the entity managed by the item
CREATE TYPE "ItemActionType" AS ENUM ('add', 'modify', 'delete', 'noChange');

-- It's a Order item that has been executed previously.
CREATE TYPE "RelatedOrderItem" AS ("orderItemAction" "ItemActionType", "orderHref" text, "@referredType" text, "role" text, "orderId" text, "orderItemId" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The polymorphic attributes @type, @schemaLocation & @referredType are related to the Product entity and not the ProductRefOrValue class itself
CREATE TYPE "OneOfProductRefOrValue" AS ("Product" jsonb, "ProductRef" "ProductRef");

-- Provides all amounts (tax included, duty free, tax rate), used currency and percentage to apply for Price and Price Alteration.
CREATE TYPE "Price" AS ("dutyFreeAmount" "Money", "percentage" real, "taxIncludedAmount" "Money", "taxRate" real, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Is an amount, usually of money, that modifies the price charged for an order item.
CREATE TYPE "PriceAlteration" AS ("applicationDuration" integer, "description" text, "name" text, "productOfferingPrice" "ProductOfferingPriceRef", "priceType" text, "priority" integer, "recurringChargePeriod" text, "unitOfMeasure" text, "price" "Price", "@type" text, "@baseType" text, "@schemaLocation" text);

-- Description of price and discount awarded
CREATE TYPE "ProductPrice" AS ("description" text, "name" text, "productOfferingPrice" "ProductOfferingPriceRef", "recurringChargePeriod" text, "unitOfMeasure" text, "price" "Price", "priceAlteration" "PriceAlteration"[], "priceType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Used to describe relationship between product.
CREATE TYPE "ProductRelationship" AS ("id" text, "relationshipType" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Description of a productTerm linked to this product. This represent a commitment with a duration
CREATE TYPE "ProductTerm" AS ("description" text, "duration" "Duration", "validFor" "TimePeriod", "name" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Valid values for the lifecycle state of the individual
CREATE TYPE "IndividualStateType" AS ENUM ('initialized', 'validated', 'deceased');

-- Keeps track of other names, for example the old name of a woman before marriage or an artist name.
CREATE TYPE "OtherNameIndividual" AS ("title" text, "aristocraticTitle" text, "generation" text, "givenName" text, "preferredGivenName" text, "familyNamePrefix" text, "familyName" text, "legalName" text, "middleName" text, "fullName" text, "formattedName" text, "validFor" "TimePeriod");

-- Represents our registration of information used as proof of identity by an individual (passport, national identity card, drivers license, social security number, birth certificate)
CREATE TYPE "IndividualIdentification" AS ("identificationId" text, "issuingAuthority" text, "issuingDate" timestamp(0) with time zone, "identificationType" text, "validFor" "TimePeriod", "attachment" "OneOfAttachmentRefOrValue", "@type" text, "@baseType" text, "@schemaLocation" text);

-- Lack or inadequate strength or ability.
CREATE TYPE "Disability" AS ("disabilityCode" text, "disabilityName" text, "validFor" "TimePeriod");

-- Ability of an individual to understand or converse in a language.
CREATE TYPE "LanguageAbility" AS ("languageCode" text, "languageName" text, "isFavouriteLanguage" boolean, "writingProficiency" text, "readingProficiency" text, "speakingProficiency" text, "listeningProficiency" text, "validFor" "TimePeriod");

-- Skills evaluated for an individual with a level and possibly with a limited validity when an obsolescence is defined (Ex: the first-aid certificate first level is limited to one year and an update training is required each year to keep the level).
CREATE TYPE "Skill" AS ("skillCode" text, "skillName" text, "evaluatedLevel" text, "comment" text, "validFor" "TimePeriod");

-- Reference of a tax definition. A tax is levied by an authorized tax jurisdiction. For example, there are many different types of tax (Federal Tax levied by the US Government, State Tax levied by the State of California, City Tax levied by the City of Los Angeles, etc.).
CREATE TYPE "TaxDefinition" AS ("id" text, "name" text, "validFor" "TimePeriod", "jurisdictionName" text, "jurisdictionLevel" text, "taxType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A tax exemption certificate represents a tax exemption granted to a party (individual or organization) by a tax jurisdiction which may be a city, state, country,... An exemption has a certificate identifier (received from the jurisdiction that levied the tax) and a validity period. An exemption is per tax types and determines for each type of tax what portion of the tax is exempted (partial by percentage or complete) via the tax definition.
CREATE TYPE "TaxExemptionCertificate" AS ("id" text, "taxDefinition" "TaxDefinition"[], "validFor" "TimePeriod", "certificateNumber" text, "issuingJurisdiction" text, "reason" text, "attachment" "OneOfAttachmentRefOrValue", "@type" text, "@baseType" text, "@schemaLocation" text);

-- An individual might be evaluated for its worthiness and this evaluation might be based on a credit rating given by a credit agency.
CREATE TYPE "PartyCreditProfile" AS ("creditAgencyName" text, "creditAgencyType" text, "ratingReference" text, "ratingScore" integer, "validFor" "TimePeriod", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Individual represents a single human being (a man, woman or child). The individual can be a customer, an employee or any other person that the organization needs to store information about.
CREATE TYPE "Individual" AS ("gender" text, "placeOfBirth" text, "countryOfBirth" text, "nationality" text, "maritalStatus" text, "birthDate" timestamp(0) with time zone, "deathDate" timestamp(0) with time zone, "title" text, "aristocraticTitle" text, "generation" text, "preferredGivenName" text, "familyNamePrefix" text, "legalName" text, "middleName" text, "name" text, "formattedName" text, "location" text, "status" "IndividualStateType", "otherName" "OtherNameIndividual"[], "individualIdentification" "IndividualIdentification"[], "disability" "Disability"[], "languageAbility" "LanguageAbility"[], "skill" "Skill"[], "familyName" text, "givenName" text, "externalReference" "ExternalIdentifier"[], "partyCharacteristic" "OneOfCharacteristic"[], "taxExemptionCertificate" "TaxExemptionCertificate"[], "creditRating" "PartyCreditProfile"[], "relatedParty" jsonb[], "contactMedium" "OneOfContactMedium"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Valid values for the lifecycle state of the organization
CREATE TYPE "OrganizationStateType" AS ENUM ('initialized', 'validated', 'closed');

-- Keeps track of other names, for example the old name of an organization.
CREATE TYPE "OtherNameOrganization" AS ("tradingName" text, "nameType" text, "name" text, "validFor" "TimePeriod", "@type" text, "@baseType" text, "@schemaLocation" text);

-- Represents our registration of information used as proof of identity by an organization
CREATE TYPE "OrganizationIdentification" AS ("identificationId" text, "issuingAuthority" text, "issuingDate" timestamp(0) with time zone, "identificationType" text, "validFor" "TimePeriod", "attachment" "OneOfAttachmentRefOrValue", "@type" text, "@baseType" text, "@schemaLocation" text);

-- Entity reference schema to be use for all entityRef class.
CREATE TYPE "OrganizationRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Child references of an organization in a structure of organizations.
CREATE TYPE "OrganizationChildRelationship" AS ("relationshipType" text, "organization" "OrganizationRef", "@type" text, "@baseType" text, "@schemaLocation" text);

-- Parent references of an organization in a structure of organizations.
CREATE TYPE "OrganizationParentRelationship" AS ("relationshipType" text, "organization" "OrganizationRef", "@type" text, "@baseType" text, "@schemaLocation" text);

-- Organization represents a group of people identified by shared interests or purpose. Examples include business, department and enterprise. Because of the complex nature of many businesses, both organizations and organization units are represented by the same data.
CREATE TYPE "Organization" AS ("isLegalEntity" boolean, "isHeadOffice" boolean, "organizationType" text, "existsDuring" "TimePeriod", "name" text, "nameType" text, "status" "OrganizationStateType", "otherName" "OtherNameOrganization"[], "organizationIdentification" "OrganizationIdentification"[], "organizationChildRelationship" "OrganizationChildRelationship"[], "organizationParentRelationship" "OrganizationParentRelationship", "tradingName" text, "externalReference" "ExternalIdentifier"[], "partyCharacteristic" "OneOfCharacteristic"[], "taxExemptionCertificate" "TaxExemptionCertificate"[], "creditRating" "PartyCreditProfile"[], "relatedParty" jsonb[], "contactMedium" "OneOfContactMedium"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Account reference. A account may be a party account or a financial account.
CREATE TYPE "AccountRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Credit profile for the party (containing credit scoring, ...). By default only the current credit profile  is retrieved. It can be used as a list to give the party credit profiles history, the first one in the list will be the current one.
CREATE TYPE "CreditProfile" AS ("creditProfileDate" timestamp(0) with time zone, "creditRiskRating" integer, "creditScore" integer, "validFor" "TimePeriod", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The part played by a party in a given context.
CREATE TYPE "PartyRole" AS ("name" text, "description" text, "role" text, "engagedParty" "PartyRef", "partyRoleSpecification" "OneOfPartyRoleSpecificationRef", "characteristic" "OneOfCharacteristic"[], "account" "AccountRef"[], "agreement" "AgreementRef"[], "contactMedium" "OneOfContactMedium"[], "paymentMethod" "PaymentMethodRef"[], "creditProfile" "CreditProfile"[], "relatedParty" jsonb[], "status" text, "statusReason" text, "validFor" "TimePeriod", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- When business partner is the Supplier 
CREATE TYPE "Supplier" AS ("name" text, "description" text, "role" text, "engagedParty" "PartyRef", "partyRoleSpecification" "OneOfPartyRoleSpecificationRef", "characteristic" "OneOfCharacteristic"[], "account" "AccountRef"[], "agreement" "AgreementRef"[], "contactMedium" "OneOfContactMedium"[], "paymentMethod" "PaymentMethodRef"[], "creditProfile" "CreditProfile"[], "relatedParty" jsonb[], "status" text, "statusReason" text, "validFor" "TimePeriod", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The part played by a party in a given context.
CREATE TYPE "Producer" AS ("name" text, "description" text, "role" text, "engagedParty" "PartyRef", "partyRoleSpecification" "OneOfPartyRoleSpecificationRef", "characteristic" "OneOfCharacteristic"[], "account" "AccountRef"[], "agreement" "AgreementRef"[], "contactMedium" "OneOfContactMedium"[], "paymentMethod" "PaymentMethodRef"[], "creditProfile" "CreditProfile"[], "relatedParty" jsonb[], "status" text, "statusReason" text, "validFor" "TimePeriod", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The part played by a party in a given context.
CREATE TYPE "Consumer" AS ("name" text, "description" text, "role" text, "engagedParty" "PartyRef", "partyRoleSpecification" "OneOfPartyRoleSpecificationRef", "characteristic" "OneOfCharacteristic"[], "account" "AccountRef"[], "agreement" "AgreementRef"[], "contactMedium" "OneOfContactMedium"[], "paymentMethod" "PaymentMethodRef"[], "creditProfile" "CreditProfile"[], "relatedParty" jsonb[], "status" text, "statusReason" text, "validFor" "TimePeriod", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- When business partner is the BusinessPartner 
CREATE TYPE "BusinessPartner" AS ("name" text, "description" text, "role" text, "engagedParty" "PartyRef", "partyRoleSpecification" "OneOfPartyRoleSpecificationRef", "characteristic" "OneOfCharacteristic"[], "account" "AccountRef"[], "agreement" "AgreementRef"[], "contactMedium" "OneOfContactMedium"[], "paymentMethod" "PaymentMethodRef"[], "creditProfile" "CreditProfile"[], "relatedParty" jsonb[], "status" text, "statusReason" text, "validFor" "TimePeriod", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The part played by a party in a given context.
CREATE TYPE "OneOfPartyRole" AS ("PartyRole" "PartyRole", "Supplier" "Supplier", "Producer" "Producer", "Consumer" "Consumer", "BusinessPartner" "BusinessPartner");

CREATE TYPE "OneOfPartyOrPartyRole" AS ("PartyRef" "PartyRef", "PartyRoleRef" "PartyRoleRef", "Individual" "Individual", "Organization" "Organization", "PartyRole" "OneOfPartyRole", "Supplier" "Supplier", "BusinessPartner" "BusinessPartner", "Consumer" "Consumer", "Producer" "Producer");

-- RelatedParty reference. A related party defines party or party role or its reference, linked to a specific entity
CREATE TYPE "RelatedPartyOrPartyRole" AS ("role" text, "partyOrPartyRole" "OneOfPartyOrPartyRole", "@type" text, "@baseType" text, "@schemaLocation" text);

-- Possible values for the status of the product
CREATE TYPE "ProductStatusType" AS ENUM ('created', 'pendingActive', 'cancelled', 'active', 'pendingTerminate', 'terminated', 'suspended', 'aborted ');

-- Intent reference, for when Intent is used by other entities
CREATE TYPE "IntentRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A uni-directionmal relationship from this entity to a target entity instance
CREATE TYPE "EntityRelationship" AS ("href" text, "name" text, "role" text, "validFor" "TimePeriod", "associationSpec" "EntityRef", "@baseType" text, "@schemaLocation" text, "relationshipType" text, "id" text, "@referredType" text, "@type" text);

-- Possible values for the serialized Expression language of an intent or Intent report
CREATE TYPE "ExpressionLanguageEnum" AS ENUM ('Turtle', 'JSON-LD', 'RDF-XML', 'Other');

-- Expression is the ontology-encoded form of the Intent
CREATE TYPE "Expression" AS ("expressionLanguage" "ExpressionLanguageEnum", "iri" text, "expressionValue" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- An Intent instance is the formal description of all expectations including requirements, goals, and constraints given to a technical system
CREATE TYPE "Intent" AS ("description" text, "validFor" "TimePeriod", "isBundle" boolean, "priority" text, "statusChangeDate" timestamp(0) with time zone, "context" text, "version" text, "intentSpecification" "EntityRef", "intentRelationship" "EntityRelationship"[], "characteristic" "OneOfCharacteristic"[], "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "attachment" "OneOfAttachmentRefOrValue"[], "name" text, "expression" "Expression", "creationDate" timestamp(0) with time zone, "lastUpdate" timestamp(0) with time zone, "lifecycleStatus" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Intent Ref (if Intent already exists) or Value (if Intent be created or its details be presented)
CREATE TYPE "OneOfIntentRefOrValue" AS ("IntentRef" "IntentRef", "Intent" "Intent");

-- A product offering procured by a customer or other interested party playing a party role. A product is realized as one or more service(s) and / or resource(s).
CREATE TYPE "Product" AS ("agreementItem" "AgreementItemRef"[], "billingAccount" "BillingAccountRef", "creationDate" timestamp(0) with time zone, "description" text, "isBundle" boolean, "isCustomerVisible" boolean, "name" text, "orderDate" timestamp(0) with time zone, "productCharacteristic" "OneOfCharacteristic"[], "productOffering" "OneOfProductOfferingRef", "productOrderItem" "RelatedOrderItem"[], "product" "OneOfProductRefOrValue"[], "productPrice" "ProductPrice"[], "productRelationship" "ProductRelationship"[], "productSerialNumber" text, "productSpecification" "ProductSpecificationRef", "productTerm" "ProductTerm"[], "realizingResource" "ResourceRef"[], "realizingService" "ServiceRef"[], "relatedParty" "RelatedPartyOrPartyRole"[], "place" "RelatedPlaceRefOrValue"[], "startDate" timestamp(0) with time zone, "status" "ProductStatusType", "terminationDate" timestamp(0) with time zone, "intent" "OneOfIntentRefOrValue", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text, "x_parentBundleId" text, "x_parentBundleName" text, "x_customerId" text, "x_creatorId" text, "x_creatorName" text);

-- A product offering procured by a customer or other interested party playing a party role. A product is realized as one or more service(s) and / or resource(s).
CREATE TABLE "product" ("agreementItem" "AgreementItemRef"[], "billingAccount" "BillingAccountRef", "creationDate" timestamp(0) with time zone, "description" text, "isBundle" boolean, "isCustomerVisible" boolean, "name" text, "orderDate" timestamp(0) with time zone, "productCharacteristic" "OneOfCharacteristic"[], "productOffering" "OneOfProductOfferingRef", "productOrderItem" "RelatedOrderItem"[], "product" "OneOfProductRefOrValue"[], "productPrice" "ProductPrice"[], "productRelationship" "ProductRelationship"[], "productSerialNumber" text, "productSpecification" "ProductSpecificationRef", "productTerm" "ProductTerm"[], "realizingResource" "ResourceRef"[], "realizingService" "ServiceRef"[], "relatedParty" "RelatedPartyOrPartyRole"[], "place" "RelatedPlaceRefOrValue"[], "startDate" timestamp(0) with time zone, "status" "ProductStatusType", "terminationDate" timestamp(0) with time zone, "intent" "OneOfIntentRefOrValue", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text, "x_parentBundleId" text, "x_parentBundleName" text, "x_customerId" text, "x_creatorId" text, "x_creatorName" text);

-- action to be performed on the product
CREATE TYPE "OrderItemActionType" AS ENUM ('add', 'modify', 'delete', 'noChange');

-- RelatedServiceOrderItem (a ServiceOrder item) .The service order item which triggered service creation/change/termination.
CREATE TYPE "RelatedServiceOrderItem" AS ("@referredType" text, "serviceOrderHref" text, "serviceOrderId" text, "itemAction" "OrderItemActionType", "itemId" text, "role" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Configuration feature
CREATE TYPE "FeatureRelationship" AS ("relationshipType" text, "id" text, "name" text, "validFor" "TimePeriod");

-- Constraint reference. The Constraint resource represents a policy/rule applied to an entity or entity spec.
CREATE TYPE "ConstraintRef" AS ("version" text, "id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Configuration feature.
CREATE TYPE "Feature" AS ("isBundle" boolean, "featureRelationship" "FeatureRelationship"[], "featureCharacteristic" "OneOfCharacteristic"[], "constraint" "ConstraintRef"[], "isEnabled" boolean, "id" text, "name" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Base entity schema for use in TMForum Open-APIs. Property.
CREATE TYPE "Entity" AS ("href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

CREATE TYPE "OneOfEntityRefOrValue" AS ("Entity" "Entity", "EntityRef" "EntityRef", "ServiceSpecificationRef" "ServiceSpecificationRef");

-- A reference to an entity, where the type of the entity is not known in advance. A related entity defines a entity described by reference or by value linked to a specific entity. The polymorphic attributes @type, @schemaLocation & @referredType are related to the Entity and not the RelatedEntityRefOrValue class itself
CREATE TYPE "RelatedEntityRefOrValue" AS ("role" text, "entity" "OneOfEntityRefOrValue", "@type" text, "@baseType" text, "@schemaLocation" text);

-- The polymorphic attributes @type, @schemaLocation & @referredType are related to the Service entity and not the ServiceRefOrValue class itself
CREATE TYPE "OneOfServiceRefOrValue" AS ("Service" jsonb, "ServiceRef" "ServiceRef");

-- Base Extensible schema for use in TMForum Open-APIs - When used for in a schema it means that the Entity described by the schema  MUST be extended with the @type
CREATE TYPE "ServiceRelationship" AS ("serviceRelationshipCharacteristic" "OneOfCharacteristic"[], "service" "OneOfServiceRefOrValue", "relationshipType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Valid values for the lifecycle state of the service
CREATE TYPE "ServiceStateType" AS ENUM ('feasibilityChecked', 'designed', 'reserved', 'inactive', 'active', 'terminated', 'suspended');

-- Valid values for the Operating status of the service
CREATE TYPE "ServiceOperatingStatusType" AS ENUM ('pending', 'configured', 'starting', 'running', 'degraded', 'failed', 'limited', 'stopping', 'stopped', 'unknown');

-- Service is a base class for defining the Service hierarchy. All Services are characterized as either being possibly visible and usable by a Customer or not. This gives rise to the two subclasses of Service: CustomerFacingService and ResourceFacingService.
CREATE TYPE "Service" AS ("x_customStatus" text, "description" text, "isServiceEnabled" boolean, "hasStarted" boolean, "startMode" text, "isStateful" boolean, "startDate" timestamp(0) with time zone, "endDate" timestamp(0) with time zone, "serviceOrderItem" "RelatedServiceOrderItem"[], "note" "Note"[], "serviceType" text, "isBundle" boolean, "name" text, "category" text, "feature" "Feature"[], "relatedEntity" "RelatedEntityRefOrValue"[], "externalIdentifier" "ExternalIdentifier"[], "serviceCharacteristic" "OneOfCharacteristic"[], "serviceRelationship" "ServiceRelationship"[], "supportingService" "OneOfServiceRefOrValue"[], "supportingResource" "ResourceRef"[], "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "place" "RelatedPlaceRefOrValue"[], "state" "ServiceStateType", "operatingStatus" "ServiceOperatingStatusType", "serviceSpecification" "ServiceSpecificationRef", "serviceDate" text, "intent" "OneOfIntentRefOrValue", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text, "x_serviceType" text, "x_externalId" text, "x_billingAccountId" text, "x_billingAccountName" text, "x_picEmail" text, "x_subscriptionId" text, "x_subscriptionName" text, "x_accountId" text, "x_accountName" text, "x_missingBillingAccount" boolean, "x_missingPicEmail" boolean, "x_missingExternalId" boolean, "x_migratedToHeroku" boolean, "x_migratedData" boolean, "x_has1867Issue" boolean, "x_solutionId" text, "x_solutionName" text, "x_fibreVoiceOE" boolean, "x_fibreFibreOE" boolean, "x_mobileESMSOE" boolean, "x_accessVoiceOE" boolean);

-- Service is a base class for defining the Service hierarchy. All Services are characterized as either being possibly visible and usable by a Customer or not. This gives rise to the two subclasses of Service: CustomerFacingService and ResourceFacingService.
CREATE TABLE "service" ("x_customStatus" text, "description" text, "isServiceEnabled" boolean, "hasStarted" boolean, "startMode" text, "isStateful" boolean, "startDate" timestamp(0) with time zone, "endDate" timestamp(0) with time zone, "serviceOrderItem" "RelatedServiceOrderItem"[], "note" "Note"[], "serviceType" text, "isBundle" boolean, "name" text, "category" text, "feature" "Feature"[], "relatedEntity" "RelatedEntityRefOrValue"[], "externalIdentifier" "ExternalIdentifier"[], "serviceCharacteristic" "OneOfCharacteristic"[], "serviceRelationship" "ServiceRelationship"[], "supportingService" "OneOfServiceRefOrValue"[], "supportingResource" "ResourceRef"[], "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "place" "RelatedPlaceRefOrValue"[], "state" "ServiceStateType", "operatingStatus" "ServiceOperatingStatusType", "serviceSpecification" "ServiceSpecificationRef", "serviceDate" text, "intent" "OneOfIntentRefOrValue", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text, "x_serviceType" text, "x_externalId" text, "x_billingAccountId" text, "x_billingAccountName" text, "x_picEmail" text, "x_subscriptionId" text, "x_subscriptionName" text, "x_accountId" text, "x_accountName" text, "x_missingBillingAccount" boolean, "x_missingPicEmail" boolean, "x_missingExternalId" boolean, "x_migratedToHeroku" boolean, "x_migratedData" boolean, "x_has1867Issue" boolean, "x_solutionId" text, "x_solutionName" text, "x_fibreVoiceOE" boolean, "x_fibreFibreOE" boolean, "x_mobileESMSOE" boolean, "x_accessVoiceOE" boolean);

-- ResourceUsageSpecification reference. ResourceUsageSpecification is a detailed description of a usage event that are of interest to the business and can have charges applied to it. It is comprised of characteristics, which define all attributes known for a particular type of usage.
CREATE TYPE "ResourceUsageSpecificationRef" AS ("href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text, "name" text, "@referredType" text);

-- ResourceUsage reference. ResourceUsage is usage event for Resource.
CREATE TYPE "ResourceUsageRef" AS ("href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text, "name" text, "@referredType" text);

-- An occurrence of usage on a Resource,derived from various Service usages. It is comprised of characteristics, which represent attributes of service usage.
CREATE TYPE "ResourceUsage" AS ("usageDate" timestamp(0) with time zone, "description" text, "usageType" text, "isBundle" boolean, "usageCharacteristic" "OneOfCharacteristic"[], "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "resource" "ResourceRef", "usageSpecification" "ResourceUsageSpecificationRef", "bundledResourceUsage" "ResourceUsageRef"[], "externalIdentifier" "ExternalIdentifier"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- An occurrence of usage on a Resource,derived from various Service usages. It is comprised of characteristics, which represent attributes of service usage.
CREATE TABLE "resourceUsage" ("usageDate" timestamp(0) with time zone, "description" text, "usageType" text, "isBundle" boolean, "usageCharacteristic" "OneOfCharacteristic"[], "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "resource" "ResourceRef", "usageSpecification" "ResourceUsageSpecificationRef", "bundledResourceUsage" "ResourceUsageRef"[], "externalIdentifier" "ExternalIdentifier"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A dependency, substitution or exclusivity relationship between/among resource usage specifications.
CREATE TYPE "ResourceUsageSpecRelationship" AS ("relationshipType" text, "role" text, "validFor" "TimePeriod", "id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A detailed description of a Resource usage event that are of interest to the business and can have charges applied to it. It is comprised of characteristics, which define all attributes known for a particular type of usage.
CREATE TYPE "ResourceUsageSpecification" AS ("name" text, "description" text, "isBundle" boolean, "lastUpdate" timestamp(0) with time zone, "lifecycleStatus" text, "version" text, "resourceSpecification" "ResourceSpecificationRef"[], "specCharacteristic" "CharacteristicSpecification"[], "attachment" "OneOfAttachmentRefOrValue"[], "bundledResourceUsageSpecification" "ResourceUsageSpecificationRef"[], "resourceUsageSpecRelationship" "ResourceUsageSpecRelationship"[], "validFor" "TimePeriod", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A detailed description of a Resource usage event that are of interest to the business and can have charges applied to it. It is comprised of characteristics, which define all attributes known for a particular type of usage.
CREATE TABLE "resourceUsageSpecification" ("name" text, "description" text, "isBundle" boolean, "lastUpdate" timestamp(0) with time zone, "lifecycleStatus" text, "version" text, "resourceSpecification" "ResourceSpecificationRef"[], "specCharacteristic" "CharacteristicSpecification"[], "attachment" "OneOfAttachmentRefOrValue"[], "bundledResourceUsageSpecification" "ResourceUsageSpecificationRef"[], "resourceUsageSpecRelationship" "ResourceUsageSpecRelationship"[], "validFor" "TimePeriod", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The (resource) category resource is used to group resource candidates in logical containers. Categories can contain other categories.
CREATE TYPE "ResourceCategoryRef" AS ("version" text, "id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The root entity for resource catalog management.
-- A resource catalog is a group of resource specifications made available through resource candidates that an organization provides to the consumers (internal consumers like its employees or B2B customers or B2C customers).
CREATE TYPE "ResourceCatalog" AS ("category" "ResourceCategoryRef"[], "externalIdentifier" "ExternalIdentifier"[], "description" text, "catalogType" text, "validFor" "TimePeriod", "version" text, "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "lastUpdate" timestamp(0) with time zone, "lifecycleStatus" text, "name" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The root entity for resource catalog management.
-- A resource catalog is a group of resource specifications made available through resource candidates that an organization provides to the consumers (internal consumers like its employees or B2B customers or B2C customers).
CREATE TABLE "resourceCatalog" ("category" "ResourceCategoryRef"[], "externalIdentifier" "ExternalIdentifier"[], "description" text, "catalogType" text, "validFor" "TimePeriod", "version" text, "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "lastUpdate" timestamp(0) with time zone, "lifecycleStatus" text, "name" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The (resource) category resource is used to group resource candidates in logical containers. Categories can contain other categories.
CREATE TYPE "ResourceCategory" AS ("description" text, "name" text, "version" text, "validFor" "TimePeriod", "lifecycleStatus" text, "lastUpdate" timestamp(0) with time zone, "parentId" text, "isRoot" boolean, "category" "ResourceCategoryRef"[], "resourceSpecification" "ResourceSpecificationRef"[], "resourceCandidate" "ResourceCandidateRef"[], "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "externalIdentifier" "ExternalIdentifier"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The (resource) category resource is used to group resource candidates in logical containers. Categories can contain other categories.
CREATE TABLE "resourceCategory" ("description" text, "name" text, "version" text, "validFor" "TimePeriod", "lifecycleStatus" text, "lastUpdate" timestamp(0) with time zone, "parentId" text, "isRoot" boolean, "category" "ResourceCategoryRef"[], "resourceSpecification" "ResourceSpecificationRef"[], "resourceCandidate" "ResourceCandidateRef"[], "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "externalIdentifier" "ExternalIdentifier"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- ResourceCandidate is an entity that makes a resource specification available to a catalog. A ResourceCandidate and its associated resource specification may be published - made visible - in any number of resource catalogs, or in none.
CREATE TYPE "ResourceCandidate" AS ("description" text, "version" text, "validFor" "TimePeriod", "lastUpdate" timestamp(0) with time zone, "lifecycleStatus" text, "category" "ResourceCategoryRef"[], "resourceSpecification" "ResourceSpecificationRef", "externalIdentifier" "ExternalIdentifier"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- ResourceCandidate is an entity that makes a resource specification available to a catalog. A ResourceCandidate and its associated resource specification may be published - made visible - in any number of resource catalogs, or in none.
CREATE TABLE "resourceCandidate" ("description" text, "version" text, "validFor" "TimePeriod", "lastUpdate" timestamp(0) with time zone, "lifecycleStatus" text, "category" "ResourceCategoryRef"[], "resourceSpecification" "ResourceSpecificationRef", "externalIdentifier" "ExternalIdentifier"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The reference object to the schema and type of target resource which is described by resource specification
CREATE TYPE "TargetResourceSchema" AS ("@type" text, "@schemaLocation" text);

-- Relationship between feature specifications
CREATE TYPE "FeatureSpecificationRelationship" AS ("relationshipType" text, "featureId" text, "parentSpecificationId" text, "parentSpecificationHref" text, "name" text, "validFor" "TimePeriod", "@type" text, "@baseType" text, "@schemaLocation" text);

-- Specification for an entity features
CREATE TYPE "FeatureSpecification" AS ("version" text, "id" text, "isBundle" boolean, "validFor" "TimePeriod", "featureSpecRelationship" "FeatureSpecificationRelationship"[], "policyConstraint" "PolicyRef"[], "isEnabled" boolean, "featureSpecCharacteristic" "CharacteristicSpecification"[], "name" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A migration, substitution, dependency or exclusivity relationship between/among resource specifications.
CREATE TYPE "ResourceSpecificationRelationship" AS ("relationshipType" text, "role" text, "id" text, "href" text, "name" text, "defaultQuantity" integer, "maximumQuantity" integer, "minimumQuantity" integer, "characteristic" "CharacteristicSpecification"[], "validFor" "TimePeriod", "@type" text, "@baseType" text, "@schemaLocation" text);

-- Resources are physical or non-physical components (or some combination of these) within an enterprise's infrastructure or inventory. They are typically consumed or used by services (for example a physical port assigned to a service) or contribute to the realization of a Product (for example, a SIM card). They can be drawn from the Application, Computing and Network domains, and include, for example, Network Elements, software, IT systems, content and information, and technology components.
-- A ResourceSpecification is a base class that represents a generic means for implementing a particular type of Resource. In essence, a ResourceSpecification defines the common attributes and relationships of a set of related Resources, while Resource defines a specific instance that is based on a particular ResourceSpecification.
CREATE TYPE "ResourceSpecification" AS ("description" text, "version" text, "validFor" "TimePeriod", "isBundle" boolean, "lastUpdate" timestamp(0) with time zone, "lifecycleStatus" text, "name" text, "category" text, "targetResourceSchema" "TargetResourceSchema", "featureSpecification" "FeatureSpecification"[], "attachment" "OneOfAttachmentRefOrValue"[], "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "resourceSpecCharacteristic" "CharacteristicSpecification"[], "resourceSpecRelationship" "ResourceSpecificationRelationship"[], "intentSpecification" "IntentSpecificationRef", "externalIdentifier" "ExternalIdentifier"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- This is a derived class of ResourceSpecification, and is used to define the invariant characteristics and behavior (attributes, methods, constraints, and relationships) of a PhysicalResource.
CREATE TYPE "PhysicalResourceSpecification" AS ("model" text, "part" text, "sku" text, "vendor" text, "description" text, "version" text, "validFor" "TimePeriod", "isBundle" boolean, "lastUpdate" timestamp(0) with time zone, "lifecycleStatus" text, "name" text, "category" text, "targetResourceSchema" "TargetResourceSchema", "featureSpecification" "FeatureSpecification"[], "attachment" "OneOfAttachmentRefOrValue"[], "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "resourceSpecCharacteristic" "CharacteristicSpecification"[], "resourceSpecRelationship" "ResourceSpecificationRelationship"[], "intentSpecification" "IntentSpecificationRef", "externalIdentifier" "ExternalIdentifier"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- This is a derived class of ResourceSpecification, and is used to define the invariant characteristics and behavior (attributes, methods, constraints, and relationships) of a LogicalResource.
CREATE TYPE "LogicalResourceSpecification" AS ("description" text, "version" text, "validFor" "TimePeriod", "isBundle" boolean, "lastUpdate" timestamp(0) with time zone, "lifecycleStatus" text, "name" text, "category" text, "targetResourceSchema" "TargetResourceSchema", "featureSpecification" "FeatureSpecification"[], "attachment" "OneOfAttachmentRefOrValue"[], "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "resourceSpecCharacteristic" "CharacteristicSpecification"[], "resourceSpecRelationship" "ResourceSpecificationRelationship"[], "intentSpecification" "IntentSpecificationRef", "externalIdentifier" "ExternalIdentifier"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Connection point specification reference. A connection point provides a service access point (SAP) for input and/or output of the resource function.
CREATE TYPE "ConnectionPointSpecificationRef" AS ("version" text, "id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Resource graph specification reference.
CREATE TYPE "ResourceGraphSpecificationRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Describes link between resource graph specifications.
CREATE TYPE "ResourceGraphSpecificationRelationship" AS ("relationshipType" text, "resourceGraph" "ResourceGraphSpecificationRef");

-- A specification for a vertex in a resource graph.
CREATE TYPE "EndpointSpecificationRef" AS ("role" text, "isRoot" boolean, "connectionPointSpecification" "ConnectionPointSpecificationRef", "id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A specification for an edge in a resource graph.
CREATE TYPE "ConnectionSpecification" AS ("name" text, "associationType" text, "endpointSpecification" "EndpointSpecificationRef"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Resource graph specification.
CREATE TYPE "ResourceGraphSpecification" AS ("name" text, "description" text, "graphSpecificationRelationship" "ResourceGraphSpecificationRelationship"[], "connectionSpecification" "ConnectionSpecification"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Specifies a function as a behavior to transform inputs of any nature into outputs of any nature independently from the way it is provided, for example a Medium to Large Enterprise Firewall.
CREATE TYPE "ResourceFunctionSpecification" AS ("connectionPointSpecification" "ConnectionPointSpecificationRef"[], "connectivitySpecification" "ResourceGraphSpecification"[], "description" text, "version" text, "validFor" "TimePeriod", "isBundle" boolean, "lastUpdate" timestamp(0) with time zone, "lifecycleStatus" text, "name" text, "category" text, "targetResourceSchema" "TargetResourceSchema", "featureSpecification" "FeatureSpecification"[], "attachment" "OneOfAttachmentRefOrValue"[], "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "resourceSpecCharacteristic" "CharacteristicSpecification"[], "resourceSpecRelationship" "ResourceSpecificationRelationship"[], "intentSpecification" "IntentSpecificationRef", "externalIdentifier" "ExternalIdentifier"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Resources are physical or non-physical components (or some combination of these) within an enterprise's infrastructure or inventory. They are typically consumed or used by services (for example a physical port assigned to a service) or contribute to the realization of a Product (for example, a SIM card). They can be drawn from the Application, Computing and Network domains, and include, for example, Network Elements, software, IT systems, content and information, and technology components.
-- A ResourceSpecification is a base class that represents a generic means for implementing a particular type of Resource. In essence, a ResourceSpecification defines the common attributes and relationships of a set of related Resources, while Resource defines a specific instance that is based on a particular ResourceSpecification.
CREATE TYPE "OneOfResourceSpecification" AS ("ResourceSpecification" "ResourceSpecification", "PhysicalResourceSpecification" "PhysicalResourceSpecification", "LogicalResourceSpecification" "LogicalResourceSpecification", "ResourceFunctionSpecification" "ResourceFunctionSpecification");

-- Resources are physical or non-physical components (or some combination of these) within an enterprise's infrastructure or inventory. They are typically consumed or used by services (for example a physical port assigned to a service) or contribute to the realization of a Product (for example, a SIM card). They can be drawn from the Application, Computing and Network domains, and include, for example, Network Elements, software, IT systems, content and information, and technology components.
-- A ResourceSpecification is a base class that represents a generic means for implementing a particular type of Resource. In essence, a ResourceSpecification defines the common attributes and relationships of a set of related Resources, while Resource defines a specific instance that is based on a particular ResourceSpecification.
CREATE TABLE "resourceSpecification" ("ResourceSpecification" "ResourceSpecification", "PhysicalResourceSpecification" "PhysicalResourceSpecification", "LogicalResourceSpecification" "LogicalResourceSpecification", "ResourceFunctionSpecification" "ResourceFunctionSpecification");

-- Possible values for the state of the Cdr transaction
CREATE TYPE "CdrTransactionStateType" AS ENUM ('charged', 'billed', 'paid', 'completed');

-- Possible values for the requested initial state of the transaction from client- by default created is considered
CREATE TYPE "CdrTransactionInitialStateType" AS ENUM ('charged');

-- Related channel to another entity. May be online web, mobile app, social ,etc.
CREATE TYPE "RelatedChannel" AS ("role" text, "channel" "ChannelRef", "@type" text, "@baseType" text, "@schemaLocation" text);

-- Possible values for the status of the Cdr
CREATE TYPE "CdrStatusType" AS ENUM ('settlement', 'charging', 'charged');

-- Possible values for the Direction of the Cdr
CREATE TYPE "CdrDirectionType" AS ENUM ('charge', 'refund');

-- An occurrence of employing a cdr for its intended purpose with all rating details
CREATE TYPE "RatedCdr" AS ("isBilled" boolean, "offerTariffType" text, "ratingAmountType" text, "ratingDate" timestamp(0) with time zone, "isTaxExempt" boolean, "productRef" "ProductRef", "taxExcludedRatingAmount" "Money", "taxIncludedRatingAmount" "Money", "taxRate" real);

-- An occurrence of employing a product for its intended purpose with all rating details
CREATE TYPE "Cdr" AS ("cdrDate" timestamp(0) with time zone, "description" text, "status" "CdrStatusType", "cdrType" text, "cdrCharacteristic" "CdrCharacteristic"[], "cdrDirectionType" "CdrDirectionType", "relatedParty" "RelatedPartyRefOrPartyRoleRef", "ratedCdr" "RatedCdr"[], "isBilled" boolean, "offerTariffType" text, "ratingAmountType" text, "amount" "Money", "ratingDate" timestamp(0) with time zone, "isTaxExempt" boolean, "productRef" "ProductRef", "taxExcludedRatingAmount" "Money", "taxIncludedRatingAmount" "Money", "taxRate" real);

-- Possible values for the state of the party revenue sharing transaction
CREATE TYPE "CdrTransactionItemStateType" AS ENUM ('charged', 'billed', 'paid', 'completed');

-- An identified part of the transaction. A transaction is decomposed into one or more transaction items.
CREATE TYPE "CdrTransactionItem" AS ("action" "ItemActionType", "cdr" "Cdr"[], "relatedParty" "RelatedPartyRefOrPartyRoleRef", "bill" "CustomerBillRef"[], "payment" "PaymentRef"[], "state" "CdrTransactionItemStateType", "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A party revenue sharing transaction is a type of transaction which  can  be used to  launch a revenue share between a partner and a service provider or between multiple partners
CREATE TYPE "CdrTransaction" AS ("relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "state" "CdrTransactionStateType", "requestedInitialState" "CdrTransactionInitialStateType", "cancellationDate" timestamp(0) with time zone, "cancellationReason" text, "channel" "RelatedChannel"[], "description" text, "note" "Note"[], "transactionItem" "CdrTransactionItem"[], "creationDate" timestamp(0) with time zone, "completionDate" timestamp(0) with time zone, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A party revenue sharing transaction is a type of transaction which  can  be used to  launch a revenue share between a partner and a service provider or between multiple partners
CREATE TABLE "cdrTransaction" ("relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "state" "CdrTransactionStateType", "requestedInitialState" "CdrTransactionInitialStateType", "cancellationDate" timestamp(0) with time zone, "cancellationReason" text, "channel" "RelatedChannel"[], "description" text, "note" "Note"[], "transactionItem" "CdrTransactionItem"[], "creationDate" timestamp(0) with time zone, "completionDate" timestamp(0) with time zone, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Reference to managed PolicyCondition object
CREATE TYPE "PolicyConditionRef" AS ("@type" text, "id" text, "href" text, "name" text, "@referredType" text, "@baseType" text, "@schemaLocation" text);

-- Reference to PolicyVariable object
CREATE TYPE "PolicyVariableRef" AS ("@type" text, "id" text, "href" text, "name" text, "@referredType" text, "@baseType" text, "@schemaLocation" text);

-- The policy condition variable and value of PartyRevSharingPolicyAlgorithm
CREATE TYPE "PartyRevSharingPolicyConditionVariable" AS ("value" text, "policyCondition" "PolicyConditionRef", "policyConditionVariable" "PolicyVariableRef", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Reference to PolicyAction object
CREATE TYPE "PolicyActionRef" AS ("@type" text, "id" text, "href" text, "name" text, "@referredType" text, "@baseType" text, "@schemaLocation" text);

-- The policy action variable and value of PartyRevSharingPolicyAlgorithm
CREATE TYPE "PartyRevSharingPolicyActionVariable" AS ("value" text, "policyAction" "PolicyActionRef", "policyActionVariable" "PolicyVariableRef", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The PartyRevSharingAlgorithm resource is policy type of algorithm to calculate revenue share
CREATE TYPE "PartyRevSharingAlgorithm" AS ("name" text, "description" text, "policy" "PolicyRef"[], "conditionVariable" "PartyRevSharingPolicyConditionVariable"[], "actionVariable" "PartyRevSharingPolicyActionVariable"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The PartyRevSharingAlgorithm resource is policy type of algorithm to calculate revenue share
CREATE TABLE "partyRevSharingAlgorithm" ("name" text, "description" text, "policy" "PolicyRef"[], "conditionVariable" "PartyRevSharingPolicyConditionVariable"[], "actionVariable" "PartyRevSharingPolicyActionVariable"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- An Intent expression
CREATE TYPE "IntentExpression" AS ("iri" text, "@type" text, "@baseType" text, "@schemaLocation" text);

CREATE TYPE "common" AS ("@id" text, "@value" text, "@language" text, "@type" text, "@container" text, "@list" jsonb, "@set" jsonb, "@reverse" jsonb, "@base" text, "@vocab" text);

-- Json LD expression value schema
CREATE TYPE "JsonLdExpressionValue" AS ("@id" text, "@value" text, "@language" text, "@type" text, "@container" text, "@list" jsonb, "@set" jsonb, "@reverse" jsonb, "@base" text, "@vocab" text, "@graph" "common"[], "@context" jsonb);

-- JsonLdExpression is the ontology-encoded form of the Intent
CREATE TYPE "JsonLdExpression" AS ("expressionValue" "JsonLdExpressionValue", "iri" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- TurtleExpression is the ontology-encoded form of the Intent as Turtle RDF
CREATE TYPE "TurtleExpression" AS ("expressionValue" text, "iri" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- An Intent expression
CREATE TYPE "OneOfIntentExpression" AS ("IntentExpression" "IntentExpression", "JsonLdExpression" "JsonLdExpression", "TurtleExpression" "TurtleExpression");

-- An Probe Intent instance is the formal description of all expectations including requirements, goals, and constraints given to a technical system
CREATE TYPE "ProbeIntent" AS ("description" text, "validFor" "TimePeriod", "isBundle" boolean, "priority" text, "statusChangeDate" timestamp(0) with time zone, "context" text, "version" text, "intentSpecification" "EntityRef", "intentRelationship" "EntityRelationship"[], "characteristic" "OneOfCharacteristic"[], "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "attachment" "OneOfAttachmentRefOrValue"[], "name" text, "expression" "OneOfIntentExpression", "creationDate" timestamp(0) with time zone, "lastUpdate" timestamp(0) with time zone, "lifecycleStatus" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- An Intent instance is the formal description of all expectations including requirements, goals, and constraints given to a technical system
CREATE TYPE "OneOfIntent" AS ("Intent" "Intent", "ProbeIntent" "ProbeIntent");

-- An Intent instance is the formal description of all expectations including requirements, goals, and constraints given to a technical system
CREATE TABLE "intent" ("Intent" "Intent", "ProbeIntent" "ProbeIntent");

-- IntentReport is the mechanism to report back to Intent owner on an Intents status
CREATE TYPE "IntentReport" AS ("description" text, "validFor" "TimePeriod", "intent" "OneOfIntentRefOrValue", "name" text, "expression" "OneOfIntentExpression", "creationDate" timestamp(0) with time zone, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- IntentReport is the mechanism to report back to Intent owner on an Intents status
CREATE TABLE "intentReport" ("description" text, "validFor" "TimePeriod", "intent" "OneOfIntentRefOrValue", "name" text, "expression" "OneOfIntentExpression", "creationDate" timestamp(0) with time zone, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Expression Specification is the ontology-encoded form of the Intent
CREATE TYPE "ExpressionSpecification" AS ("expressionLanguage" text, "iri" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A  substitution, dependency or exclusivity relationship between/among IntentSpecification.
CREATE TYPE "IntentSpecificationRelationship" AS ("role" text, "relationshipType" text, "validFor" "TimePeriod", "id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The reference object to the schema and type of target entity which is described by a specification
CREATE TYPE "TargetEntitySchema" AS ("@type" text, "@schemaLocation" text);

-- reference to an AssociationSpecification object
CREATE TYPE "AssociationSpecificationRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A migration, substitution, dependency or exclusivity relationship between/among entity specifications.
CREATE TYPE "EntitySpecificationRelationship" AS ("href" text, "name" text, "role" text, "validFor" "TimePeriod", "associationSpec" "AssociationSpecificationRef", "@baseType" text, "@schemaLocation" text, "relationshipType" text);

-- IntentSpecification is a class that offers characteristics to describe a type of intent.
-- Functionally, it acts as a template by which intents may be instantiated. 
CREATE TYPE "IntentSpecification" AS ("expressionSpecification" "ExpressionSpecification", "intentSpecRelationship" "IntentSpecificationRelationship"[], "isBundle" boolean, "version" text, "name" text, "description" text, "lastUpdate" timestamp(0) with time zone, "lifecycleStatus" text, "validFor" "TimePeriod", "attachment" "OneOfAttachmentRefOrValue"[], "targetEntitySchema" "TargetEntitySchema", "specCharacteristic" "CharacteristicSpecification"[], "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "constraint" "ConstraintRef"[], "entitySpecRelationship" "EntitySpecificationRelationship"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- IntentSpecification is a class that offers characteristics to describe a type of intent.
-- Functionally, it acts as a template by which intents may be instantiated. 
CREATE TABLE "intentSpecification" ("expressionSpecification" "ExpressionSpecification", "intentSpecRelationship" "IntentSpecificationRelationship"[], "isBundle" boolean, "version" text, "name" text, "description" text, "lastUpdate" timestamp(0) with time zone, "lifecycleStatus" text, "validFor" "TimePeriod", "attachment" "OneOfAttachmentRefOrValue"[], "targetEntitySchema" "TargetEntitySchema", "specCharacteristic" "CharacteristicSpecification"[], "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "constraint" "ConstraintRef"[], "entitySpecRelationship" "EntitySpecificationRelationship"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- An amount, usually of money, that represents the actual price paid by the customer for this item. May represent the total price of the shopping cart or the total of the cart item depending on the relation
CREATE TYPE "CartPrice" AS ("description" text, "name" text, "priceType" text, "productOfferingPrice" "ProductOfferingPriceRef", "recurringChargePeriod" text, "unitOfMeasure" text, "price" "Price", "priceAlteration" "PriceAlteration"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- action to be performed on the product
CREATE TYPE "CartItemActionType" AS ENUM ('add', 'modify', 'delete', 'noChange');

-- Possible values for the status of the cart item, saveForLater items are not calculated in the cart prices
CREATE TYPE "CartItemStatusType" AS ENUM ('active', 'saveForLater');

-- Base Extensible schema for use in TMForum Open-APIs - When used for in a schema it means that the Entity described by the schema  MUST be extended with the @type
CREATE TYPE "CartTerm" AS ("description" text, "duration" "Duration", "name" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Relationship among cart items mainly other than hierarchical relationships such as "relyOn", "dependentOn", "shipping" etc.
CREATE TYPE "CartItemRelationship" AS ("id" text, "relationshipType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- An identified part of the shopping cart. A shopping cart  is decomposed into one or more shopping cart item. Cart item represents a product offering or bundled product offering that user wish to purchase, as well as the pricing of the product offering, reference to product in case of configured characteristic or installation address. Cart items can be related to other cart item to related bundled offerings or reference cart Items to a shipping options
CREATE TYPE "CartItem" AS ("action" "CartItemActionType", "id" text, "quantity" integer, "status" "CartItemStatusType", "itemTerm" "CartTerm"[], "cartItem" jsonb[], "note" "Note"[], "itemTotalPrice" "CartPrice"[], "product" "OneOfProductRefOrValue", "itemPrice" "CartPrice"[], "productOffering" "OneOfProductOfferingRef", "cartItemRelationship" "CartItemRelationship"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- Shopping Cart resource is used for the temporarily selection and reservation of product offerings in e-commerce, call center and retail purchase. Shopping cart supports purchase of both physical and digital goods and service (e.g. handset, telecom network service). Shopping Cart contain list of cart items, a reference to customer (partyRole) or contact medium in case customer not exist, and the total items price including promotions
CREATE TYPE "ShoppingCart" AS ("validFor" "TimePeriod", "contactMedium" "OneOfContactMedium"[], "cartTotalPrice" "CartPrice"[], "cartItem" "CartItem"[], "relatedParty" "RelatedPartyOrPartyRole"[], "status" text, "creationDate" timestamp(0) with time zone, "lastUpdate" timestamp(0) with time zone, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Shopping Cart resource is used for the temporarily selection and reservation of product offerings in e-commerce, call center and retail purchase. Shopping cart supports purchase of both physical and digital goods and service (e.g. handset, telecom network service). Shopping Cart contain list of cart items, a reference to customer (partyRole) or contact medium in case customer not exist, and the total items price including promotions
CREATE TABLE "shoppingCart" ("validFor" "TimePeriod", "contactMedium" "OneOfContactMedium"[], "cartTotalPrice" "CartPrice"[], "cartItem" "CartItem"[], "relatedParty" "RelatedPartyOrPartyRole"[], "status" text, "creationDate" timestamp(0) with time zone, "lastUpdate" timestamp(0) with time zone, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- An identified part of the order. A product order is decomposed into one or more order items.
CREATE TYPE "DCSProductOrderItem" AS ("@type" text, "@baseType" text, "@schemaLocation" text);

-- Possible values for the state of the order
CREATE TYPE "ProductOrderStateType" AS ENUM ('acknowledged', 'rejected', 'pending', 'held', 'inProgress', 'cancelled', 'completed', 'failed', 'partial', 'assessingCancellation', 'pendingCancellation', 'draft', 'inProgress.accepted');

-- An ApiProductOrder is a specialization of a TMForum ProductOrder, which can be used to place an order between a customer and a service provider or between a service provider and a partner and vice versa.
CREATE TYPE "ApiProductOrder" AS ("description" text, "externalId" "ExternalIdentifier"[], "productOrderItem" "DCSProductOrderItem"[], "agreement" "AgreementRef"[], "channelPartner" "PartyRoleRef", "state" "ProductOrderStateType", "creationDate" timestamp(0) with time zone, "expectedCompletionDate" timestamp(0) with time zone, "completionDate" timestamp(0) with time zone, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- An ApiProductOrder is a specialization of a TMForum ProductOrder, which can be used to place an order between a customer and a service provider or between a service provider and a partner and vice versa.
CREATE TABLE "apiProductOrder" ("description" text, "externalId" "ExternalIdentifier"[], "productOrderItem" "DCSProductOrderItem"[], "agreement" "AgreementRef"[], "channelPartner" "PartyRoleRef", "state" "ProductOrderStateType", "creationDate" timestamp(0) with time zone, "expectedCompletionDate" timestamp(0) with time zone, "completionDate" timestamp(0) with time zone, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The corresponding identification of the resource in different standard, regulatory definitions. The standard specification identifier (e.g., ISO 3166-1 Alpha-2) and the corresponding value (e.g., BE) relevant to a particular resource.
CREATE TYPE "ISO31661Alpha2StandardIdentifier" AS ("value" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A set of ApiProductCharacteristics grouped together for usage grant.
CREATE TYPE "ApiGrantInformation" AS ("purpose" text, "scope" text[], "grantType" text[], "legalBasis" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A set of ApiProduct characteristics grouped together by API major version.
CREATE TYPE "ApiVersionDetails" AS ("apiMajorVersion" integer, "basePath" text, "countryCode" "ISO31661Alpha2StandardIdentifier", "apiGrantInformation" "ApiGrantInformation"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- Reference to the ProductOfferingTermOrCondition specification.
CREATE TYPE "ProductOfferingTermOrConditionSpecRef" AS ("version" text, "id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Describes who has been authorized to sign the API ProductOfferingTermOrCondition.
CREATE TYPE "ApiAuthorization" AS ("name" text, "approver" "RelatedPartyRefOrPartyRoleRef", "@type" text, "@baseType" text, "@schemaLocation" text);

-- Approval entity for the ProductOfferingTermOrCondition. Exists when Terms or Conditions are approved.
CREATE TYPE "ProductOfferingTermOrConditionApproval" AS ("approvalDate" timestamp(0) with time zone, "authorization" "ApiAuthorization"[]);

-- Approved Terms or Conditions of the ProductOffering.
CREATE TYPE "ProductOfferingTermOrCondition" AS ("id" text, "name" text, "productOfferingTermOrConditionSpecRef" "ProductOfferingTermOrConditionSpecRef", "productOfferingTermOrConditionApproval" "ProductOfferingTermOrConditionApproval", "@type" text, "@baseType" text, "@schemaLocation" text);

-- A product offering procured by a customer or other interested party playing a party role. A product is realized as one or more service(s) and / or resource(s).
CREATE TYPE "ApiProduct" AS ("name" text, "description" text, "productOffering" "OneOfProductOfferingRef", "productSpecification" "ProductSpecificationRef", "apiName" text, "apiVersionDetails" "ApiVersionDetails"[], "productOrderItem" "RelatedOrderItem"[], "approvedProductOfferingTermOrCondition" "ProductOfferingTermOrCondition"[], "status" "ProductStatusType", "creationDate" timestamp(0) with time zone, "startDate" timestamp(0) with time zone, "orderDate" timestamp(0) with time zone, "terminationDate" timestamp(0) with time zone, "channelPartner" "PartyRoleRef", "agreementItem" "AgreementItemRef"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A product offering procured by a customer or other interested party playing a party role. A product is realized as one or more service(s) and / or resource(s).
CREATE TABLE "apiProduct" ("name" text, "description" text, "productOffering" "OneOfProductOfferingRef", "productSpecification" "ProductSpecificationRef", "apiName" text, "apiVersionDetails" "ApiVersionDetails"[], "productOrderItem" "RelatedOrderItem"[], "approvedProductOfferingTermOrCondition" "ProductOfferingTermOrCondition"[], "status" "ProductStatusType", "creationDate" timestamp(0) with time zone, "startDate" timestamp(0) with time zone, "orderDate" timestamp(0) with time zone, "terminationDate" timestamp(0) with time zone, "channelPartner" "PartyRoleRef", "agreementItem" "AgreementItemRef"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Valid values for an approvalStatus in the context of an approval process.
CREATE TYPE "ApprovalStatusType" AS ENUM ('pendingApproval', 'approved', 'rejected');

-- OAuth2ClientCredential describes the registration attributes in an OAuth registration process
CREATE TYPE "OAuth2ClientCredential" AS ("clientSecret" text, "state" text, "validFor" "TimePeriod", "@type" text, "@baseType" text, "@schemaLocation" text);

-- ApiDigitalIdentity is a class that allow to describe a digital identity for an individual or a resource or a specific party role. One of these three MUST be provided. If an individual is provided, this identity will be for all her/his partyRole. To avoid confusion it is recommended in this case to not provide partyRoleIdentified.
CREATE TYPE "ApiDigitalIdentity" AS ("clientId" text, "redirectUrl" text[], "jwksUri" text, "validFor" "TimePeriod", "status" text, "credential" "OAuth2ClientCredential"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- Defines a group of API assets to which access can be controlled
CREATE TYPE "ApiListAssetGroup" AS ("apiProduct" "ProductRef"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- A ApiConsumerPermission allows an Application to consume a API.
CREATE TYPE "ApiConsumerPermission" AS ("managedAssetGroup" "ApiListAssetGroup", "@type" text, "@baseType" text, "@schemaLocation" text);

-- The PermissionSet is a set of Permissions granted to a user (party, party role or resource). The set may be granted explicitly by an authorized user or may be acquired implicitly due to the role that the user is playing.
CREATE TYPE "ApiPermissionSet" AS ("creationDate" timestamp(0) with time zone, "description" text, "validFor" "TimePeriod", "permission" "ApiConsumerPermission", "@type" text, "@baseType" text, "@schemaLocation" text);

-- Logic Resource Role
CREATE TYPE "LogicalResourceRole" AS ("grantedPermissionSet" "ApiPermissionSet"[]);

-- ResourceOperationalStateType enumerations
CREATE TYPE "ResourceOperationalStateType" AS ENUM ('enable', 'disable');

-- An Application is a kind-of LogicalResource is a type of resource that describes the common set of attributes shared by all concrete logical resources (e.g. TPE, MSISDN, IP Addresses) in the inventory.
CREATE TYPE "Application" AS ("commercialName" text, "logoUrl" text, "privacyPolicyURL" text, "category" text, "approvalStatus" "ApprovalStatusType", "approvalStatusReason" text, "applicationOwner" "PartyRoleRef", "channelPartner" "PartyRoleRef", "digitalIdentity" "ApiDigitalIdentity", "apiConsumerRole" "LogicalResourceRole"[], "description" text, "name" text, "operationalState" "ResourceOperationalStateType", "resourceVersion" text, "externalIdentifier" "ExternalIdentifier"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- An Application is a kind-of LogicalResource is a type of resource that describes the common set of attributes shared by all concrete logical resources (e.g. TPE, MSISDN, IP Addresses) in the inventory.
CREATE TABLE "application" ("commercialName" text, "logoUrl" text, "privacyPolicyURL" text, "category" text, "approvalStatus" "ApprovalStatusType", "approvalStatusReason" text, "applicationOwner" "PartyRoleRef", "channelPartner" "PartyRoleRef", "digitalIdentity" "ApiDigitalIdentity", "apiConsumerRole" "LogicalResourceRole"[], "description" text, "name" text, "operationalState" "ResourceOperationalStateType", "resourceVersion" text, "externalIdentifier" "ExternalIdentifier"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- ApplicationOwnerRelatedIndividual represents a single human being (a man, woman or child). The individual can be a customer, an employee or any other person that the organization needs to store information about.
CREATE TYPE "ApplicationOwnerRelatedIndividual" AS ("familyName" text, "givenName" text, "contactMedium" "OneOfContactMedium"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- Application Organization represents a group of people identified by shared interests or purpose. Examples include business, department and enterprise. Because of the complex nature of many businesses, both organizations and organization units are represented by the same data.
CREATE TYPE "ApplicationOwnerRelatedOrganization" AS ("name" text, "contactMedium" "OneOfContactMedium"[], "organizationType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

CREATE TYPE "OneOfApplicationOwnerPartyOrPartyRole" AS ("ApplicationOwnerRelatedIndividual" "ApplicationOwnerRelatedIndividual", "ApplicationOwnerRelatedOrganization" "ApplicationOwnerRelatedOrganization");

-- Representation of a GeographicSubAddress 
-- It is used for addressing within a property in an urban area (country properties are often defined differently). It may refer to a building, a building cluster, or a floor of a multistory building.
CREATE TYPE "LightGeographicSubAddress" AS ("buildingName" text, "levelNumber" text, "levelType" text, "privateStreetName" text, "privateStreetNumber" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Structured textual way of describing how to find a Property in an urban area (country properties are often defined differently).
-- Note : Address corresponds to SID UrbanPropertyAddress
CREATE TYPE "LightGeographicAddress" AS ("streetNr" text, "streetName" text, "locality" text, "city" text, "stateOrProvince" text, "countryCode" "ISO31661Alpha2StandardIdentifier", "postcode" text, "geographicSubAddress" "LightGeographicSubAddress", "@type" text, "@baseType" text, "@schemaLocation" text);

-- Application Organization represents a group of people identified by shared interests or purpose. Examples include business, department and enterprise. Because of the complex nature of many businesses, both organizations and organization units are represented by the same data.
CREATE TYPE "ApplicationOwnerOrganization" AS ("name" text, "nameType" text, "tradingName" text, "organizationType" text, "organizationIdentification" "OrganizationIdentification"[], "isLegalEntity" boolean, "externalReference" "ExternalIdentifier"[], "contactMedium" "OneOfContactMedium"[], "legalRepresentative" "ApplicationOwnerRelatedIndividual", "dataProtectionOfficer" "OneOfApplicationOwnerPartyOrPartyRole", "privacyManager" "OneOfApplicationOwnerPartyOrPartyRole", "registeredGeographicAddress" "LightGeographicAddress", "taxNumber" text, "privacyPolicyURL" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Used to track the lifecycle status of the ApplicationOwner in Channel Partner IT. So this attribute is allowed to be contributed by the Channel Partner and patchable..
CREATE TYPE "ApplicationOwnerStatusType" AS ENUM ('active', 'inactive');

-- Application Owner. Application Owner represents the legal representative of the organization in a given context.
CREATE TYPE "ApplicationOwner" AS ("name" text, "description" text, "engagedParty" "ApplicationOwnerOrganization", "channelPartner" "PartyRoleRef", "approvalStatus" "ApprovalStatusType", "approvalStatusReason" text, "status" "ApplicationOwnerStatusType", "statusReason" text, "validFor" "TimePeriod", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Application Owner. Application Owner represents the legal representative of the organization in a given context.
CREATE TABLE "applicationOwner" ("name" text, "description" text, "engagedParty" "ApplicationOwnerOrganization", "channelPartner" "PartyRoleRef", "approvalStatus" "ApprovalStatusType", "approvalStatusReason" text, "status" "ApplicationOwnerStatusType", "statusReason" text, "validFor" "TimePeriod", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- An item typically included in a request or response
CREATE TYPE "HeaderItem" AS ("name" text, "value" text);

-- A response to a request
CREATE TYPE "Request" AS ("method" text, "to" text, "body" jsonb, "header" "HeaderItem"[]);

-- A response to a request
CREATE TYPE "Response" AS ("statusCode" text, "body" jsonb, "header" "HeaderItem"[]);

-- Monitoring of resources
CREATE TYPE "Monitor" AS ("request" "Request", "response" "Response", "sourceHref" text, "state" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Monitoring of resources
CREATE TABLE "monitor" ("request" "Request", "response" "Response", "sourceHref" text, "state" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Reason for understanding the eligibility result, whatever the result is (availability or unavailability).
CREATE TYPE "EligibilityResultReason" AS ("label" text, "code" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Structure used to describe relationship between productOfferingQualification item from the same ProductOfferingQualification.
CREATE TYPE "ProductOfferingQualificationItemRelationship" AS ("id" text, "relationshipType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Extra information about a given entity
CREATE TYPE "TerminationError" AS ("id" text, "value" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Promotion reference. Promotion Resource is used to provide the additional discount, voucher, bonus or gift to the customer who meets the pre-defined criteria. Using promotion, the enterprise is able to attract the users and encourage more consumption, especially continuous purchases.
CREATE TYPE "PromotionRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Alternate product Offering proposal is used when the requested product offering is not available with characteristic and date asked for. An alternate proposal could be a distinct product offering or product Spec close to requested one or same as requested but with a different activation date.
CREATE TYPE "AlternateProductOfferingProposal" AS ("alternateActivationDate" timestamp(0) with time zone, "alternateProduct" "OneOfProductRefOrValue", "alternateProductOffering" "OneOfProductOfferingRef", "promotion" "PromotionRef", "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Base Extensible schema for use in TMForum Open-APIs - When used for in a schema it means that the Entity described by the schema  MUST be extended with the @type
CREATE TYPE "CheckProductOfferingQualificationItem" AS ("expectedActivationDate" timestamp(0) with time zone, "eligibilityResultReason" "EligibilityResultReason"[], "qualificationItemRelationship" "ProductOfferingQualificationItemRelationship"[], "CheckProductOfferingQualificationItem" jsonb[], "note" "Note"[], "product" "OneOfProductRefOrValue", "category" "CategoryRef", "terminationError" "TerminationError"[], "productOffering" "OneOfProductOfferingRef", "promotion" "PromotionRef", "alternateProductOfferingProposal" "AlternateProductOfferingProposal"[], "action" text, "id" text, "qualificationItemResult" text, "state" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Possible values for the state of a task
CREATE TYPE "TaskStateType" AS ENUM ('acknowledged', 'rejected', 'inProgress', 'cancelled', 'done', 'terminatedWithError');

-- CheckProductOfferingQualification is used to perform a commercial eligibility. It allows to request an eligibility check for a list of productOfferings (one per item). The response will provide qualification result depending on catalog rules and of the context of the interaction (defined be place, channel, party, product).
CREATE TYPE "CheckProductOfferingQualification" AS ("href" text, "id" text, "channel" "ChannelRef", "description" text, "effectiveQualificationDate" timestamp(0) with time zone, "expectedQualificationCompletionDate" timestamp(0) with time zone, "expirationDate" timestamp(0) with time zone, "instantSyncQualification" boolean, "note" "Note"[], "checkProductOfferingQualificationItem" "CheckProductOfferingQualificationItem"[], "provideAlternative" boolean, "provideOnlyAvailable" boolean, "provideResultReason" boolean, "qualificationResult" text, "relatedParty" "RelatedPartyOrPartyRole"[], "requestedQualificationCompletionDate" timestamp(0) with time zone, "state" "TaskStateType", "creationDate" timestamp(0) with time zone, "@type" text, "@baseType" text, "@schemaLocation" text);

-- CheckProductOfferingQualification is used to perform a commercial eligibility. It allows to request an eligibility check for a list of productOfferings (one per item). The response will provide qualification result depending on catalog rules and of the context of the interaction (defined be place, channel, party, product).
CREATE TABLE "checkProductOfferingQualification" ("href" text, "id" text, "channel" "ChannelRef", "description" text, "effectiveQualificationDate" timestamp(0) with time zone, "expectedQualificationCompletionDate" timestamp(0) with time zone, "expirationDate" timestamp(0) with time zone, "instantSyncQualification" boolean, "note" "Note"[], "checkProductOfferingQualificationItem" "CheckProductOfferingQualificationItem"[], "provideAlternative" boolean, "provideOnlyAvailable" boolean, "provideResultReason" boolean, "qualificationResult" text, "relatedParty" "RelatedPartyOrPartyRole"[], "requestedQualificationCompletionDate" timestamp(0) with time zone, "state" "TaskStateType", "creationDate" timestamp(0) with time zone, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Base Extensible schema for use in TMForum Open-APIs - When used for in a schema it means that the Entity described by the schema  MUST be extended with the @type
CREATE TYPE "QueryProductOfferingQualificationItem" AS ("qualificationItemRelationship" "ProductOfferingQualificationItemRelationship"[], "product" "OneOfProductRefOrValue", "productOffering" "OneOfProductOfferingRef", "category" "CategoryRef", "promotion" "PromotionRef", "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- QueryProductOfferingQualification is used to perform a commercial eligibility. It allows client side to pass a list of criteria (search criteria to provide the context of the qualification) and in the response the seller send (if any) a list of product offering qualified.
CREATE TYPE "QueryProductOfferingQualification" AS ("href" text, "id" text, "channel" "ChannelRef", "description" text, "effectiveQualificationDate" timestamp(0) with time zone, "expectedQualificationCompletionDate" timestamp(0) with time zone, "expirationDate" timestamp(0) with time zone, "instantSyncQualification" boolean, "note" "Note"[], "qualifiedProductOfferingItem" "QueryProductOfferingQualificationItem"[], "searchCriteria" "QueryProductOfferingQualificationItem", "relatedParty" "RelatedPartyOrPartyRole"[], "requestedQualificationCompletionDate" timestamp(0) with time zone, "state" "TaskStateType", "creationDate" timestamp(0) with time zone, "@type" text, "@baseType" text, "@schemaLocation" text);

-- QueryProductOfferingQualification is used to perform a commercial eligibility. It allows client side to pass a list of criteria (search criteria to provide the context of the qualification) and in the response the seller send (if any) a list of product offering qualified.
CREATE TABLE "queryProductOfferingQualification" ("href" text, "id" text, "channel" "ChannelRef", "description" text, "effectiveQualificationDate" timestamp(0) with time zone, "expectedQualificationCompletionDate" timestamp(0) with time zone, "expirationDate" timestamp(0) with time zone, "instantSyncQualification" boolean, "note" "Note"[], "qualifiedProductOfferingItem" "QueryProductOfferingQualificationItem"[], "searchCriteria" "QueryProductOfferingQualificationItem", "relatedParty" "RelatedPartyOrPartyRole"[], "requestedQualificationCompletionDate" timestamp(0) with time zone, "state" "TaskStateType", "creationDate" timestamp(0) with time zone, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The part played by a party in a given context.
CREATE TYPE "Customer" AS ("name" text, "description" text, "role" text, "engagedParty" "PartyRef", "partyRoleSpecification" "OneOfPartyRoleSpecificationRef", "characteristic" "OneOfCharacteristic"[], "account" "AccountRef"[], "agreement" "AgreementRef"[], "contactMedium" "OneOfContactMedium"[], "paymentMethod" "PaymentMethodRef"[], "creditProfile" "CreditProfile"[], "relatedParty" "RelatedPartyOrPartyRole"[], "status" text, "statusReason" text, "validFor" "TimePeriod", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The part played by a party in a given context.
CREATE TABLE "customer" ("name" text, "description" text, "role" text, "engagedParty" "PartyRef", "partyRoleSpecification" "OneOfPartyRoleSpecificationRef", "characteristic" "OneOfCharacteristic"[], "account" "AccountRef"[], "agreement" "AgreementRef"[], "contactMedium" "OneOfContactMedium"[], "paymentMethod" "PaymentMethodRef"[], "creditProfile" "CreditProfile"[], "relatedParty" "RelatedPartyOrPartyRole"[], "status" text, "statusReason" text, "validFor" "TimePeriod", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- PartyAccount reference. A party account is an arrangement that a party has with an enterprise that provides products to the party.
CREATE TYPE "PartyAccountRef" AS ("description" text, "status" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text, "name" text, "@referredType" text);

-- A PartyRevSharingAlgorithmRef reference
CREATE TYPE "PartyRevSharingAlgorithmRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The PartyRevSharingModelInvolPrice resource define offering price(s) associated to the party rev sharing model involvement 
CREATE TYPE "PartyRevSharingModelInvolPrice" AS ("name" text, "description" text, "productOfferingPrice" "ProductOfferingPriceRef", "partyRevSharingAlgorithm" "PartyRevSharingAlgorithmRef"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The PartyRevSharingModelItemInvolvement resource specifies a party, including an enterprise, who participates in revenue sharing, their type of involvement, and their associated offering(s). 
CREATE TYPE "PartyRevSharingModelItemInvolvement" AS ("name" text, "description" text, "productOffering" "OneOfProductOfferingRef"[], "offeringPrice" "PartyRevSharingModelInvolPrice"[], "agreementItem" "AgreementItemRef"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The PartyRevSharingModelItem resource define how revenue is shared by an enterprise with one or more other parties
CREATE TYPE "PartyRevSharingModelItem" AS ("name" text, "description" text, "relatedParty" "RelatedPartyRefOrPartyRoleRef", "partyAccount" "PartyAccountRef", "sharingModelItemInvolvement" "PartyRevSharingModelItemInvolvement"[], "agreement" "AgreementRef"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The PartyRevSharingModel resource define how revenue is shared by an enterprise with one or more other parties
CREATE TYPE "PartyRevSharingModel" AS ("name" text, "description" text, "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "partyRevSharingModelItem" "PartyRevSharingModelItem"[], "productSpecification" "ProductSpecificationRef"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The PartyRevSharingModel resource define how revenue is shared by an enterprise with one or more other parties
CREATE TABLE "partyRevSharingModel" ("name" text, "description" text, "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "partyRevSharingModelItem" "PartyRevSharingModelItem"[], "productSpecification" "ProductSpecificationRef"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Used to describe relationship between interaction items.
CREATE TYPE "InteractionItemRelationship" AS ("id" text, "relationshipType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Base Extensible schema for use in TMForum Open-APIs - When used for in a schema it means that the Entity described by the schema  MUST be extended with the @type
CREATE TYPE "InteractionItem" AS ("id" text, "itemDate" "TimePeriod", "reason" text, "resolution" text, "creationDate" timestamp(0) with time zone, "lastUpdate" timestamp(0) with time zone, "item" "RelatedEntityRefOrValue", "relatedChannel" "RelatedChannel"[], "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "attachment" "OneOfAttachmentRefOrValue"[], "note" "Note"[], "interactionItemRelationship" "InteractionItemRelationship"[], "interactionItemType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Entity reference schema to be use for all entityRef class.
CREATE TYPE "InteractionRelationship" AS ("id" text, "relationshipType" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Base entity schema for use in TMForum Open-APIs. Property.
CREATE TYPE "PartyInteraction" AS ("relatedChannel" "RelatedChannel"[], "direction" text, "reason" text, "interactionDate" "TimePeriod", "description" text, "status" text, "statusChangeDate" timestamp(0) with time zone, "creationDate" timestamp(0) with time zone, "lastUpdate" timestamp(0) with time zone, "relatedParty" "RelatedPartyOrPartyRole"[], "attachment" "OneOfAttachmentRefOrValue"[], "note" "Note"[], "interactionItem" "InteractionItem"[], "interactionRelationship" "InteractionRelationship"[], "externalIdentifier" "ExternalIdentifier"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Base entity schema for use in TMForum Open-APIs. Property.
CREATE TABLE "partyInteraction" ("relatedChannel" "RelatedChannel"[], "direction" text, "reason" text, "interactionDate" "TimePeriod", "description" text, "status" text, "statusChangeDate" timestamp(0) with time zone, "creationDate" timestamp(0) with time zone, "lastUpdate" timestamp(0) with time zone, "relatedParty" "RelatedPartyOrPartyRole"[], "attachment" "OneOfAttachmentRefOrValue"[], "note" "Note"[], "interactionItem" "InteractionItem"[], "interactionRelationship" "InteractionRelationship"[], "externalIdentifier" "ExternalIdentifier"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Individual represents a single human being (a man, woman or child). The individual can be a customer, an employee or any other person that the organization needs to store information about.
CREATE TABLE "individual" ("gender" text, "placeOfBirth" text, "countryOfBirth" text, "nationality" text, "maritalStatus" text, "birthDate" timestamp(0) with time zone, "deathDate" timestamp(0) with time zone, "title" text, "aristocraticTitle" text, "generation" text, "preferredGivenName" text, "familyNamePrefix" text, "legalName" text, "middleName" text, "name" text, "formattedName" text, "location" text, "status" "IndividualStateType", "otherName" "OtherNameIndividual"[], "individualIdentification" "IndividualIdentification"[], "disability" "Disability"[], "languageAbility" "LanguageAbility"[], "skill" "Skill"[], "familyName" text, "givenName" text, "externalReference" "ExternalIdentifier"[], "partyCharacteristic" "OneOfCharacteristic"[], "taxExemptionCertificate" "TaxExemptionCertificate"[], "creditRating" "PartyCreditProfile"[], "relatedParty" jsonb[], "contactMedium" "OneOfContactMedium"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Organization represents a group of people identified by shared interests or purpose. Examples include business, department and enterprise. Because of the complex nature of many businesses, both organizations and organization units are represented by the same data.
CREATE TABLE "organization" ("isLegalEntity" boolean, "isHeadOffice" boolean, "organizationType" text, "existsDuring" "TimePeriod", "name" text, "nameType" text, "status" "OrganizationStateType", "otherName" "OtherNameOrganization"[], "organizationIdentification" "OrganizationIdentification"[], "organizationChildRelationship" "OrganizationChildRelationship"[], "organizationParentRelationship" "OrganizationParentRelationship", "tradingName" text, "externalReference" "ExternalIdentifier"[], "partyCharacteristic" "OneOfCharacteristic"[], "taxExemptionCertificate" "TaxExemptionCertificate"[], "creditRating" "PartyCreditProfile"[], "relatedParty" jsonb[], "contactMedium" "OneOfContactMedium"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A mean of communicating a bill, supported by the associated bill format. For example, post mail, email, web page.
CREATE TYPE "BillPresentationMedia" AS ("name" text, "description" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- PresentationMedia reference. A mean of communicating a bill, supported by the associated bill format. For example, post mail, email, web page.
CREATE TYPE "BillPresentationMediaRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The polymorphic attributes @type, @schemaLocation & @referredType are related to the BillPresentationMedia entity and not the BillPresentationMediaRefOrValue class itself
CREATE TYPE "OneOfBillPresentationMediaRefOrValue" AS ("BillPresentationMedia" "BillPresentationMedia", "BillPresentationMediaRef" "BillPresentationMediaRef");

-- A detailed description of the way in which a bill is presented.
CREATE TYPE "BillFormat" AS ("name" text, "description" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- BillFormat reference. A bill format is a description of the way in which a bill is presented.
CREATE TYPE "BillFormatRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The polymorphic attributes @type, @schemaLocation & @referredType are related to the BillFormat entity and not the BillFormatRefOrValue class itself
CREATE TYPE "OneOfBillFormatRefOrValue" AS ("BillFormat" "BillFormat", "BillFormatRef" "BillFormatRef");

-- A detailed description of when to initiate a billing cycle and the various sub steps of a billing cycle.
CREATE TYPE "BillingCycleSpecification" AS ("name" text, "billingDateShift" integer, "billingPeriod" text, "chargeDateOffset" integer, "creditDateOffset" integer, "description" text, "frequency" text, "mailingDateOffset" integer, "paymentDueDateOffset" integer, "validFor" "TimePeriod", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- BillingCycleSpecification reference. A description of when to initiate a billing cycle and the various sub steps of a billing cycle.
CREATE TYPE "BillingCycleSpecificationRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The polymorphic attributes @type, @schemaLocation & @referredType are related to the BillingCycleSpecification entity and not the BillingCycleSpecificationRefOrValue class itself
CREATE TYPE "OneOfBillingCycleSpecificationRefOrValue" AS ("BillingCycleSpecification" "BillingCycleSpecification", "BillingCycleSpecificationRef" "BillingCycleSpecificationRef");

-- The structure of the bill for party accounts (billing or settlement).
CREATE TYPE "BillStructure" AS ("presentationMedia" "OneOfBillPresentationMediaRefOrValue"[], "format" "OneOfBillFormatRefOrValue", "cycleSpecification" "OneOfBillingCycleSpecificationRefOrValue", "@type" text, "@baseType" text, "@schemaLocation" text);

-- Defines a plan for payment (when a party wants to spread his payments)
CREATE TYPE "PaymentPlan" AS ("id" text, "numberOfPayments" integer, "paymentFrequency" text, "priority" integer, "status" text, "totalAmount" "Money", "planType" text, "validFor" "TimePeriod", "paymentMethod" "PaymentMethodRef", "@type" text, "@baseType" text, "@schemaLocation" text);

-- An individual or an organization used as a contact point for a given account and accessed via some contact medium.
CREATE TYPE "Contact" AS ("id" text, "contactName" text, "contactType" text, "partyRoleType" text, "validFor" "TimePeriod", "contactMedium" "OneOfContactMedium"[], "relatedParty" "RelatedPartyRefOrPartyRoleRef", "@type" text, "@baseType" text, "@schemaLocation" text);

-- Balances linked to the account
CREATE TYPE "AccountBalance" AS ("id" text, "amount" "Money", "balanceType" text, "validFor" "TimePeriod", "@type" text, "@baseType" text, "@schemaLocation" text);

-- Significant connection between accounts. For instance an aggregating account for a list of shop branches each having its own billing account.
CREATE TYPE "AccountRelationship" AS ("relationshipType" text, "validFor" "TimePeriod", "account" "AccountRef", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Account used for billing or for settlement purposes concerning a given party (an organization or an individual). It is a specialization of entity Account.
CREATE TYPE "PartyAccount" AS ("paymentStatus" text, "billStructure" "BillStructure", "paymentPlan" "PaymentPlan"[], "financialAccount" "FinancialAccountRef", "defaultPaymentMethod" "PaymentMethodRef", "creditLimit" "Money", "description" text, "lastUpdate" timestamp(0) with time zone, "name" text, "state" text, "accountType" text, "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "taxExemption" "TaxExemptionCertificate"[], "contact" "Contact"[], "accountBalance" "AccountBalance"[], "accountRelationship" "AccountRelationship"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Account used for billing or for settlement purposes concerning a given party (an organization or an individual). It is a specialization of entity Account.
CREATE TABLE "partyAccount" ("paymentStatus" text, "billStructure" "BillStructure", "paymentPlan" "PaymentPlan"[], "financialAccount" "FinancialAccountRef", "defaultPaymentMethod" "PaymentMethodRef", "creditLimit" "Money", "description" text, "lastUpdate" timestamp(0) with time zone, "name" text, "state" text, "accountType" text, "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "taxExemption" "TaxExemptionCertificate"[], "contact" "Contact"[], "accountBalance" "AccountBalance"[], "accountRelationship" "AccountRelationship"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A party account used for billing purposes. It includes a description of the bill structure (frequency, presentation media, format and so on). It is a specialization of entity PartyAccount.
CREATE TYPE "BillingAccount" AS ("ratingType" text, "paymentStatus" text, "billStructure" "BillStructure", "paymentPlan" "PaymentPlan"[], "financialAccount" "FinancialAccountRef", "defaultPaymentMethod" "PaymentMethodRef", "creditLimit" "Money", "description" text, "lastUpdate" timestamp(0) with time zone, "name" text, "state" text, "accountType" text, "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "taxExemption" "TaxExemptionCertificate"[], "contact" "Contact"[], "accountBalance" "AccountBalance"[], "accountRelationship" "AccountRelationship"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A party account used for billing purposes. It includes a description of the bill structure (frequency, presentation media, format and so on). It is a specialization of entity PartyAccount.
CREATE TABLE "billingAccount" ("ratingType" text, "paymentStatus" text, "billStructure" "BillStructure", "paymentPlan" "PaymentPlan"[], "financialAccount" "FinancialAccountRef", "defaultPaymentMethod" "PaymentMethodRef", "creditLimit" "Money", "description" text, "lastUpdate" timestamp(0) with time zone, "name" text, "state" text, "accountType" text, "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "taxExemption" "TaxExemptionCertificate"[], "contact" "Contact"[], "accountBalance" "AccountBalance"[], "accountRelationship" "AccountRelationship"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A party account used for settlement purposes. It includes a description of the bill structure (frequency, presentation media, format and so on). It is a specialization of entity PartyAccount.
CREATE TYPE "SettlementAccount" AS ("paymentStatus" text, "billStructure" "BillStructure", "paymentPlan" "PaymentPlan"[], "financialAccount" "FinancialAccountRef", "defaultPaymentMethod" "PaymentMethodRef", "creditLimit" "Money", "description" text, "lastUpdate" timestamp(0) with time zone, "name" text, "state" text, "accountType" text, "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "taxExemption" "TaxExemptionCertificate"[], "contact" "Contact"[], "accountBalance" "AccountBalance"[], "accountRelationship" "AccountRelationship"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A party account used for settlement purposes. It includes a description of the bill structure (frequency, presentation media, format and so on). It is a specialization of entity PartyAccount.
CREATE TABLE "settlementAccount" ("paymentStatus" text, "billStructure" "BillStructure", "paymentPlan" "PaymentPlan"[], "financialAccount" "FinancialAccountRef", "defaultPaymentMethod" "PaymentMethodRef", "creditLimit" "Money", "description" text, "lastUpdate" timestamp(0) with time zone, "name" text, "state" text, "accountType" text, "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "taxExemption" "TaxExemptionCertificate"[], "contact" "Contact"[], "accountBalance" "AccountBalance"[], "accountRelationship" "AccountRelationship"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- An account of money owed by a party to another entity in exchange for goods or services that have been delivered or used. A financial (account receivable account/account payable) aggregates the amounts of one or more party accounts (billing or settlement) owned by a given party. It is a specialization of entity Account.
CREATE TYPE "FinancialAccount" AS ("creditLimit" "Money", "description" text, "lastUpdate" timestamp(0) with time zone, "name" text, "state" text, "accountType" text, "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "taxExemption" "TaxExemptionCertificate"[], "contact" "Contact"[], "accountBalance" "AccountBalance"[], "accountRelationship" "AccountRelationship"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- An account of money owed by a party to another entity in exchange for goods or services that have been delivered or used. A financial (account receivable account/account payable) aggregates the amounts of one or more party accounts (billing or settlement) owned by a given party. It is a specialization of entity Account.
CREATE TABLE "financialAccount" ("creditLimit" "Money", "description" text, "lastUpdate" timestamp(0) with time zone, "name" text, "state" text, "accountType" text, "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "taxExemption" "TaxExemptionCertificate"[], "contact" "Contact"[], "accountBalance" "AccountBalance"[], "accountRelationship" "AccountRelationship"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A detailed description of the way in which a bill is presented.
CREATE TABLE "billFormat" ("name" text, "description" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A mean of communicating a bill, supported by the associated bill format. For example, post mail, email, web page.
CREATE TABLE "billPresentationMedia" ("name" text, "description" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A detailed description of when to initiate a billing cycle and the various sub steps of a billing cycle.
CREATE TABLE "billingCycleSpecification" ("name" text, "billingDateShift" integer, "billingPeriod" text, "chargeDateOffset" integer, "creditDateOffset" integer, "description" text, "frequency" text, "mailingDateOffset" integer, "paymentDueDateOffset" integer, "validFor" "TimePeriod", "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Possible values for the requested initial state of the order from client- by default acknowledged is considered
CREATE TYPE "InitialProductOrderStateType" AS ENUM ('acknowledged', 'draft');

-- An amount, usually of money, that represents the actual price paid by the Customer for this item or this order
CREATE TYPE "OrderPrice" AS ("description" text, "name" text, "productOfferingPrice" "ProductOfferingPriceRef", "recurringChargePeriod" text, "unitOfMeasure" text, "billingAccount" "BillingAccountRef", "priceAlteration" "PriceAlteration"[], "price" "Price", "priceType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Used to describe relationship between order.
CREATE TYPE "OrderRelationship" AS ("@referredType" text, "id" text, "relationshipType" text, "href" text, "name" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A productOfferingQualification that has been executed previously
CREATE TYPE "ProductOfferingQualificationRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Quote reference. It's a Quote that has been executed previously.
CREATE TYPE "QuoteRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A reference to ProductOrder item that has been executed previously.
CREATE TYPE "ProductOrderItemRef" AS ("ProductOrderHref" text, "@referredType" text, "productOrderId" text, "productOrderItemId" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A ProductOrderErrorMessage represents an error that causes a status change in a product order.
CREATE TYPE "ProductOrderErrorMessage" AS ("timestamp" timestamp(0) with time zone, "productOrderItem" "ProductOrderItemRef"[], "@type" text, "@baseType" text, "@schemaLocation" text, "code" text, "reason" text, "message" text, "status" text, "referenceError" text);

-- A ProductOrderJeopardyAlert represents a predicted exception during a product order processing that would brings risk to complete successfully the order.
CREATE TYPE "ProductOrderJeopardyAlert" AS ("productOrderItem" "ProductOrderItemRef"[], "id" text, "alertDate" timestamp(0) with time zone, "name" text, "jeopardyType" text, "exception" text, "message" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A ProductOrderMilestone represents an action or event marking a significant change or stage in processing of a product order.
CREATE TYPE "ProductOrderMilestone" AS ("productOrderItem" "ProductOrderItemRef"[], "description" text, "id" text, "status" text, "milestoneDate" timestamp(0) with time zone, "name" text, "message" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Refers an appointment, such as a Customer presentation or internal meeting or site visit
CREATE TYPE "AppointmentRef" AS ("description" text, "id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Description of a productTerm linked to this orderItem. This represent a commitment with a duration
CREATE TYPE "OrderTerm" AS ("description" text, "duration" "Duration", "name" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- It's a productOfferingQualification item that has been executed previously.
CREATE TYPE "ProductOfferingQualificationItemRef" AS ("productOfferingQualificationName" text, "productOfferingQualificationHref" text, "@referredType" text, "productOfferingQualificationId" text, "itemId" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A reference to Quote item that has been executed previously.
CREATE TYPE "QuoteItemRef" AS ("quoteHref" text, "@referredType" text, "quoteId" text, "quoteItemId" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Used to describe relationship between Order item. These relationship could have an impact on pricing and conditions
CREATE TYPE "OrderItemRelationship" AS ("id" text, "relationshipType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Possible values for the state of the product order item
CREATE TYPE "ProductOrderItemStateType" AS ENUM ('acknowledged', 'rejected', 'pending', 'held', 'inProgress', 'cancelled', 'completed', 'failed', 'partial', 'assessingCancellation', 'pendingCancellation');

-- An identified part of the order. A product order is decomposed into one or more order items.
CREATE TYPE "ProductOrderItem" AS ("quantity" integer, "action" "ItemActionType", "appointment" "AppointmentRef", "billingAccount" "BillingAccountRef", "itemPrice" "OrderPrice"[], "itemTerm" "OrderTerm"[], "itemTotalPrice" "OrderPrice"[], "note" "Note"[], "payment" "PaymentRef"[], "product" "OneOfProductRefOrValue", "productOffering" "OneOfProductOfferingRef", "productOfferingQualificationItem" "ProductOfferingQualificationItemRef", "quoteItem" "QuoteItemRef", "productOrderItem" jsonb[], "productOrderItemRelationship" "OrderItemRelationship"[], "state" "ProductOrderItemStateType", "qualification" "ProductOfferingQualificationRef"[], "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A Product Order is a type of order which  can  be used to place an order between a customer and a service provider or between a service provider and a partner and vice versa,
CREATE TYPE "ProductOrder" AS ("agreement" "AgreementRef"[], "billingAccount" "BillingAccountRef", "state" "ProductOrderStateType", "requestedInitialState" "InitialProductOrderStateType", "cancellationDate" timestamp(0) with time zone, "cancellationReason" text, "category" text, "channel" "RelatedChannel"[], "description" text, "expectedCompletionDate" timestamp(0) with time zone, "externalId" "ExternalIdentifier"[], "note" "Note"[], "notificationContact" text, "orderTotalPrice" "OrderPrice"[], "payment" "PaymentRef"[], "orderRelationship" "OrderRelationship"[], "priority" text, "productOfferingQualification" "ProductOfferingQualificationRef"[], "quote" "QuoteRef"[], "productOrderErrorMessage" "ProductOrderErrorMessage"[], "productOrderJeopardyAlert" "ProductOrderJeopardyAlert"[], "productOrderMilestone" "ProductOrderMilestone"[], "productOrderItem" "ProductOrderItem"[], "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "requestedCompletionDate" timestamp(0) with time zone, "requestedStartDate" timestamp(0) with time zone, "creationDate" timestamp(0) with time zone, "completionDate" timestamp(0) with time zone, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A Product Order is a type of order which  can  be used to place an order between a customer and a service provider or between a service provider and a partner and vice versa,
CREATE TABLE "productOrder" ("agreement" "AgreementRef"[], "billingAccount" "BillingAccountRef", "state" "ProductOrderStateType", "requestedInitialState" "InitialProductOrderStateType", "cancellationDate" timestamp(0) with time zone, "cancellationReason" text, "category" text, "channel" "RelatedChannel"[], "description" text, "expectedCompletionDate" timestamp(0) with time zone, "externalId" "ExternalIdentifier"[], "note" "Note"[], "notificationContact" text, "orderTotalPrice" "OrderPrice"[], "payment" "PaymentRef"[], "orderRelationship" "OrderRelationship"[], "priority" text, "productOfferingQualification" "ProductOfferingQualificationRef"[], "quote" "QuoteRef"[], "productOrderErrorMessage" "ProductOrderErrorMessage"[], "productOrderJeopardyAlert" "ProductOrderJeopardyAlert"[], "productOrderMilestone" "ProductOrderMilestone"[], "productOrderItem" "ProductOrderItem"[], "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "requestedCompletionDate" timestamp(0) with time zone, "requestedStartDate" timestamp(0) with time zone, "creationDate" timestamp(0) with time zone, "completionDate" timestamp(0) with time zone, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A reference to an existing Product Order.
CREATE TYPE "ProductOrderRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Request for cancellation an existing product order
CREATE TYPE "CancelProductOrder" AS ("productOrder" "ProductOrderRef", "creationDate" timestamp(0) with time zone, "requestedCancellationDate" timestamp(0) with time zone, "cancellationReason" text, "state" "TaskStateType", "effectiveCancellationDate" timestamp(0) with time zone, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Request for cancellation an existing product order
CREATE TABLE "cancelProductOrder" ("productOrder" "ProductOrderRef", "creationDate" timestamp(0) with time zone, "requestedCancellationDate" timestamp(0) with time zone, "cancellationReason" text, "state" "TaskStateType", "effectiveCancellationDate" timestamp(0) with time zone, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- StateReason represents a human readable explanation of state.
CREATE TYPE "StateReason" AS ("code" text, "label" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Describes a specific item contained in a parent element
CREATE TYPE "ItemRef" AS ("name" text, "@referredType" text, "entityHref" text, "entityId" text, "itemId" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Structure used to describe relationship between productConfiguration item from the same CheckProductConfiguration or QueryProductConfiguration.
CREATE TYPE "ProductConfigurationItemRelationship" AS ("id" text, "relationshipType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Configuration action that may be executed in the contect of the product configuration.
CREATE TYPE "ConfigurationAction" AS ("action" text, "description" text, "isSelected" boolean, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The configuration term (following ProductOfferingTerm in the product catalog).
CREATE TYPE "ConfigurationTerm" AS ("description" text, "duration" "Duration", "name" text, "validFor" "TimePeriod", "isSelectable" boolean, "isSelected" boolean, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Description of price and discount awarded.
CREATE TYPE "ConfigurationPrice" AS ("description" text, "name" text, "productOfferingPrice" "ProductOfferingPriceRef", "recurringChargePeriod" "Quantity", "unitOfMeasure" text, "price" "Price", "priceAlteration" "PriceAlteration"[], "priceType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Another ConfigurationCharacteristic that is related to the current ConfigurationCharacteristic.
CREATE TYPE "ConfigurationCharacteristicRelationship" AS ("id" text, "relationshipType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A value of a configuration characteristic.
CREATE TYPE "ConfigurationCharacteristicValue" AS ("isSelectable" boolean, "isSelected" boolean, "rangeInterval" text, "regex" text, "unitOfMeasure" text, "valueFrom" integer, "valueTo" integer, "characteristicValue" "OneOfCharacteristic", "@type" text, "@baseType" text, "@schemaLocation" text);

-- A configuration characteristic (following CharacteristicSpecification from the product catalog).
CREATE TYPE "ConfigurationCharacteristic" AS ("id" text, "name" text, "description" text, "minCardinality" integer, "maxCardinality" integer, "regex" text, "valueType" text, "isConfigurable" boolean, "configurationCharacteristicRelationship" "ConfigurationCharacteristicRelationship"[], "configurationCharacteristicValue" "ConfigurationCharacteristicValue"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- A product configuration is used to drive the configuration of a selected product offering or product in a given context (cart, quote, product order etc.).
CREATE TYPE "ProductConfiguration" AS ("id" text, "version" text, "quantity" real, "isSelectable" boolean, "isSelected" boolean, "isVisible" boolean, "productOffering" "OneOfProductOfferingRef", "productSpecification" "ProductSpecificationRef", "product" "OneOfProductRefOrValue", "bundledProductOfferingOption" "BundledProductOfferingOption", "bundledGroupProductOffering" "BundledGroupProductOffering", "policy" "PolicyRef"[], "configurationAction" "ConfigurationAction"[], "configurationTerm" "ConfigurationTerm"[], "configurationPrice" "ConfigurationPrice"[], "configurationCharacteristic" "ConfigurationCharacteristic"[], "productConfiguration" jsonb[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- CheckProductConfigurationItem represents a product configuration provided as input as well as returned as output as a result of check operation. 
CREATE TYPE "CheckProductConfigurationItem" AS ("id" text, "state" text, "stateReason" "StateReason"[], "contextItem" "ItemRef", "productConfigurationItemRelationship" "ProductConfigurationItemRelationship"[], "productConfigurationItem" jsonb[], "productConfiguration" "ProductConfiguration", "alternateProductConfigurationProposal" "ProductConfiguration"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- CheckProductConfiguration is is used to create a task that check validity of product configuration(s).
CREATE TYPE "CheckProductConfiguration" AS ("channel" "ChannelRef", "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "contextEntity" "EntityRef", "contextCharacteristic" "OneOfCharacteristic"[], "instantSync" boolean, "provideAlternatives" boolean, "state" "TaskStateType", "checkProductConfigurationItem" "CheckProductConfigurationItem"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- CheckProductConfiguration is is used to create a task that check validity of product configuration(s).
CREATE TABLE "checkProductConfiguration" ("channel" "ChannelRef", "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "contextEntity" "EntityRef", "contextCharacteristic" "OneOfCharacteristic"[], "instantSync" boolean, "provideAlternatives" boolean, "state" "TaskStateType", "checkProductConfigurationItem" "CheckProductConfigurationItem"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A query product configuration item links product configurations with the main resource (query product configuration).
CREATE TYPE "QueryProductConfigurationItem" AS ("id" text, "state" text, "stateReason" "StateReason"[], "contextItem" "ItemRef", "productConfigurationItemRelationship" "ProductConfigurationItemRelationship"[], "queryProductConfigurationItem" jsonb[], "productConfiguration" "ProductConfiguration", "@type" text, "@baseType" text, "@schemaLocation" text);

-- Query Product Configuration main resource is used to obtain product configurations in a given context (cart, quote, product order).
CREATE TYPE "QueryProductConfiguration" AS ("channel" "ChannelRef", "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "contextEntity" "EntityRef", "contextCharacteristic" "OneOfCharacteristic"[], "instantSync" boolean, "state" "TaskStateType", "requestProductConfigurationItem" "QueryProductConfigurationItem"[], "computedProductConfigurationItem" "QueryProductConfigurationItem"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Query Product Configuration main resource is used to obtain product configurations in a given context (cart, quote, product order).
CREATE TABLE "queryProductConfiguration" ("channel" "ChannelRef", "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "contextEntity" "EntityRef", "contextCharacteristic" "OneOfCharacteristic"[], "instantSync" boolean, "state" "TaskStateType", "requestProductConfigurationItem" "QueryProductConfigurationItem"[], "computedProductConfigurationItem" "QueryProductConfigurationItem"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A PartyRevSharingModelRef reference
CREATE TYPE "PartyRevSharingModelRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A CdrTransactionRef reference
CREATE TYPE "CdrTransactionRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Reference of a party revenue sharing model item.
CREATE TYPE "PartyRevSharingModelItemRef" AS ("revenueSharingModelName" text, "revenueSharingModelHref" text, "@referredType" text, "revenueSharingModelId" text, "itemId" text);

-- Reference of Cdr transaction item.
CREATE TYPE "CdrTransactionItemRef" AS ("transactionHref" text, "@referredType" text, "transactionId" text, "transactionItemId" text);

-- A PartyRevSharingAlgorithmRef reference
CREATE TYPE "PartyRevSharingModelInvolPriceRef" AS ("revenueSharingModelId" text, "revenueSharingModelItemId" text, "involPriceId" text, "id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The PartyRevSharingReportItemDetail is calculate revenue share detail to a specified partner and offer price
CREATE TYPE "PartyRevSharingReportItemDetail" AS ("partyRevSharingModelInvolPrice" "PartyRevSharingModelInvolPriceRef", "product" "ProductRef"[], "productOffering" "OneOfProductOfferingRef", "productOfferingPrice" "ProductOfferingPriceRef", "partyRevSharingAlgorithm" "PartyRevSharingAlgorithmRef"[], "money" "Money", "status" text, "createDate" timestamp(0) with time zone, "lastUpdate" timestamp(0) with time zone, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The PartyRevSharingReportItem resource define the revenue is shared by the specified partner
CREATE TYPE "PartyRevSharingReportItem" AS ("partyRevSharingModelItem" "PartyRevSharingModelItemRef", "relatedParty" "RelatedPartyRefOrPartyRoleRef", "partyAccount" "PartyAccountRef", "cdrTransactionItem" "CdrTransactionItemRef", "billPeriod" "TimePeriod", "sharingReportItemIDetail" "PartyRevSharingReportItemDetail"[], "money" "Money", "bill" "CustomerBillRef", "payment" "PaymentRef", "status" text, "createDate" timestamp(0) with time zone, "lastUpdate" timestamp(0) with time zone, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The PartyRevSharingReport resource define the revenue is shared by stakeholders
CREATE TYPE "PartyRevSharingReport" AS ("partyRevSharingModel" "PartyRevSharingModelRef", "cdrTransaction" "CdrTransactionRef", "partyRevSharingReportItem" "PartyRevSharingReportItem"[], "money" "Money", "createDate" timestamp(0) with time zone, "lastUpdate" timestamp(0) with time zone, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- The PartyRevSharingReport resource define the revenue is shared by stakeholders
CREATE TABLE "partyRevSharingReport" ("partyRevSharingModel" "PartyRevSharingModelRef", "cdrTransaction" "CdrTransactionRef", "partyRevSharingReportItem" "PartyRevSharingReportItem"[], "money" "Money", "createDate" timestamp(0) with time zone, "lastUpdate" timestamp(0) with time zone, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Categorizes the alarm (X.733 8.1.1, 3GPP TS 32.111-2 Annex A)
CREATE TYPE "AlarmType" AS ENUM ('communicationsAlarm', 'processingErrorAlarm', 'environmentalAlarm', 'qualityOfServiceAlarm', 'equipmentAlarm', 'integrityViolation', 'operationalViolation', 'physicalViolation', 'securityService', 'mechanismViolation', 'timeDomainViolation');

-- Lists the possible severities that can be allocated to an Alarm. The values are consistent with ITU-T Recommendation X.733.
-- Once an alarm has been cleared, its perceived severity is set to 'cleared' and can no longer be set.
CREATE TYPE "PerceivedSeverity" AS ENUM ('critical', 'major', 'minor', 'warning', 'indeterminate', 'cleared');

-- Reference to object which affected by Alarm (AlarmedObject).
CREATE TYPE "AlarmedObjectRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Indicates the comments entered on the alarm.
CREATE TYPE "Comment" AS ("userId" text, "systemId" text, "time" timestamp(0) with time zone, "comment" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Entity reference schema to be use for all entityRef class.
CREATE TYPE "AlarmRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Entity reference schema to be use for all entityRef class.
CREATE TYPE "ThresholdRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Identifies the details of the threshold that has been crossed.
CREATE TYPE "CrossedThresholdInformation" AS ("threshold" "ThresholdRef", "direction" text, "granularity" text, "indicatorName" text, "indicatorUnit" text, "observedValue" text, "thresholdCrossingDescription" text);

-- Place reference.
CREATE TYPE "Place" AS ("externalIdentifier" "ExternalIdentifier"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- A  Place and an associated role as installation address, delivery address, etc....
CREATE TYPE "RelatedPlace" AS ("role" text, "relatedPlace" "Place", "@type" text, "@baseType" text, "@schemaLocation" text);

-- This resource represents an alarm supporting the information model defined in ITU-T X.733.
CREATE TYPE "Alarm" AS ("externalAlarmId" text, "state" text, "alarmType" "AlarmType", "perceivedSeverity" "PerceivedSeverity", "probableCause" text, "specificProblem" text, "alarmedObjectType" text, "alarmedObject" "AlarmedObjectRef", "reportingSystemId" text, "sourceSystemId" text, "alarmDetails" text, "alarmRaisedTime" timestamp(0) with time zone, "alarmChangedTime" timestamp(0) with time zone, "alarmClearedTime" timestamp(0) with time zone, "alarmReportingTime" timestamp(0) with time zone, "ackState" text, "ackSystemId" text, "ackUserId" text, "affectedService" "ServiceRef"[], "alarmEscalation" boolean, "clearSystemId" text, "clearUserId" text, "comment" "Comment"[], "correlatedAlarm" "AlarmRef"[], "crossedThresholdInformation" "CrossedThresholdInformation", "isRootCause" boolean, "parentAlarm" "AlarmRef"[], "plannedOutageIndicator" text, "proposedRepairedActions" text, "serviceAffecting" boolean, "place" "RelatedPlace"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- This resource represents an alarm supporting the information model defined in ITU-T X.733.
CREATE TABLE "alarm" ("externalAlarmId" text, "state" text, "alarmType" "AlarmType", "perceivedSeverity" "PerceivedSeverity", "probableCause" text, "specificProblem" text, "alarmedObjectType" text, "alarmedObject" "AlarmedObjectRef", "reportingSystemId" text, "sourceSystemId" text, "alarmDetails" text, "alarmRaisedTime" timestamp(0) with time zone, "alarmChangedTime" timestamp(0) with time zone, "alarmClearedTime" timestamp(0) with time zone, "alarmReportingTime" timestamp(0) with time zone, "ackState" text, "ackSystemId" text, "ackUserId" text, "affectedService" "ServiceRef"[], "alarmEscalation" boolean, "clearSystemId" text, "clearUserId" text, "comment" "Comment"[], "correlatedAlarm" "AlarmRef"[], "crossedThresholdInformation" "CrossedThresholdInformation", "isRootCause" boolean, "parentAlarm" "AlarmRef"[], "plannedOutageIndicator" text, "proposedRepairedActions" text, "serviceAffecting" boolean, "place" "RelatedPlace"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- An alarm defined by reference or value. The polymorphic attributes @type, @schemaLocation & @referredType are related to the Alarm entity and not the AlarmRefOrValue class itself
CREATE TYPE "OneOfAlarmRefOrValue" AS ("Alarm" "Alarm", "AlarmRef" "AlarmRef");

-- Task resource for the acknowledge alarms operation
CREATE TYPE "AckAlarm" AS ("state" text, "ackSystemId" text, "ackTime" timestamp(0) with time zone, "ackUserId" text, "ackedAlarm" "OneOfAlarmRefOrValue"[], "alarmPattern" "OneOfAlarmRefOrValue"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Task resource for the acknowledge alarms operation
CREATE TABLE "ackAlarm" ("state" text, "ackSystemId" text, "ackTime" timestamp(0) with time zone, "ackUserId" text, "ackedAlarm" "OneOfAlarmRefOrValue"[], "alarmPattern" "OneOfAlarmRefOrValue"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Task resource for unacknowledge alarms operation
CREATE TYPE "UnAckAlarm" AS ("id" text, "href" text, "state" text, "ackSystemId" text, "ackUserId" text, "ackTime" timestamp(0) with time zone, "alarmPattern" "OneOfAlarmRefOrValue"[], "unAckedAlarm" "OneOfAlarmRefOrValue"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- Task resource for unacknowledge alarms operation
CREATE TABLE "unAckAlarm" ("id" text, "href" text, "state" text, "ackSystemId" text, "ackUserId" text, "ackTime" timestamp(0) with time zone, "alarmPattern" "OneOfAlarmRefOrValue"[], "unAckedAlarm" "OneOfAlarmRefOrValue"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- Task resource for clear alarms operation
CREATE TYPE "ClearAlarm" AS ("state" text, "clearSystemId" text, "clearUserId" text, "alarmClearedTime" timestamp(0) with time zone, "alarmPattern" "OneOfAlarmRefOrValue"[], "clearedAlarm" "OneOfAlarmRefOrValue"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Task resource for clear alarms operation
CREATE TABLE "clearAlarm" ("state" text, "clearSystemId" text, "clearUserId" text, "alarmClearedTime" timestamp(0) with time zone, "alarmPattern" "OneOfAlarmRefOrValue"[], "clearedAlarm" "OneOfAlarmRefOrValue"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Task resource for comment alarms operation
CREATE TYPE "CommentAlarm" AS ("id" text, "href" text, "state" text, "comment" "Comment", "alarmPattern" "OneOfAlarmRefOrValue"[], "commentedAlarm" "OneOfAlarmRefOrValue"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- Task resource for comment alarms operation
CREATE TABLE "commentAlarm" ("id" text, "href" text, "state" text, "comment" "Comment", "alarmPattern" "OneOfAlarmRefOrValue"[], "commentedAlarm" "OneOfAlarmRefOrValue"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- Task resource for group alarms operation
CREATE TYPE "GroupAlarm" AS ("id" text, "href" text, "state" text, "sourceSystemId" text, "alarmChangedTime" timestamp(0) with time zone, "parentAlarm" "OneOfAlarmRefOrValue", "correlatedAlarm" "OneOfAlarmRefOrValue"[], "groupedAlarm" "OneOfAlarmRefOrValue"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- Task resource for group alarms operation
CREATE TABLE "groupAlarm" ("id" text, "href" text, "state" text, "sourceSystemId" text, "alarmChangedTime" timestamp(0) with time zone, "parentAlarm" "OneOfAlarmRefOrValue", "correlatedAlarm" "OneOfAlarmRefOrValue"[], "groupedAlarm" "OneOfAlarmRefOrValue"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- Task resource for ungroup alarms operation
CREATE TYPE "UnGroupAlarm" AS ("id" text, "href" text, "state" text, "sourceSystemId" text, "alarmChangedTime" timestamp(0) with time zone, "parentAlarm" "OneOfAlarmRefOrValue", "correlatedAlarm" "OneOfAlarmRefOrValue"[], "unGroupedAlarm" "OneOfAlarmRefOrValue"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- Task resource for ungroup alarms operation
CREATE TABLE "unGroupAlarm" ("id" text, "href" text, "state" text, "sourceSystemId" text, "alarmChangedTime" timestamp(0) with time zone, "parentAlarm" "OneOfAlarmRefOrValue", "correlatedAlarm" "OneOfAlarmRefOrValue"[], "unGroupedAlarm" "OneOfAlarmRefOrValue"[], "@type" text, "@baseType" text, "@schemaLocation" text);

-- The part played by a party in a given context.
CREATE TABLE "partyRole" ("PartyRole" "PartyRole", "Supplier" "Supplier", "Producer" "Producer", "Consumer" "Consumer", "BusinessPartner" "BusinessPartner");

-- A PermissionSpecificationSet defines a set of permissions that can be attached to a party role specification. The resulting permissions will then apply to all users that adopt this party role.
CREATE TYPE "PermissionSpecificationSetRef" AS ("id" text, "href" text, "name" text, "@referredType" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Party role specification. A party role specification gives additional details on the part played by a party in a given context.
CREATE TYPE "PartyRoleSpecification" AS ("agreementSpecification" "AgreementSpecificationRef"[], "permissionSpecificationSet" "PermissionSpecificationSetRef"[], "status" text, "name" text, "description" text, "lastUpdate" timestamp(0) with time zone, "lifecycleStatus" text, "isBundle" boolean, "validFor" "TimePeriod", "version" text, "attachment" "OneOfAttachmentRefOrValue"[], "targetEntitySchema" "TargetEntitySchema", "specCharacteristic" "CharacteristicSpecification"[], "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "constraint" "ConstraintRef"[], "entitySpecRelationship" "EntitySpecificationRelationship"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Party role specification. A party role specification gives additional details on the part played by a party in a given context.
CREATE TABLE "partyRoleSpecification" ("agreementSpecification" "AgreementSpecificationRef"[], "permissionSpecificationSet" "PermissionSpecificationSetRef"[], "status" text, "name" text, "description" text, "lastUpdate" timestamp(0) with time zone, "lifecycleStatus" text, "isBundle" boolean, "validFor" "TimePeriod", "version" text, "attachment" "OneOfAttachmentRefOrValue"[], "targetEntitySchema" "TargetEntitySchema", "specCharacteristic" "CharacteristicSpecification"[], "relatedParty" "RelatedPartyRefOrPartyRoleRef"[], "constraint" "ConstraintRef"[], "entitySpecRelationship" "EntitySpecificationRelationship"[], "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- FailedMigrationProduct: A pre-filtered product type for solutions with failed migrations
-- This entity maps to a view that filters csord__Solution__c WHERE csord__External_Identifier__c = 'Not Migrated Successfully'
CREATE TYPE "FailedMigrationProduct" AS ("name" text, "description" text, "solutionType" text, "status" text, "migrationStatus" text, "createdByName" text, "createdDate" timestamp(0) with time zone, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- Table for FailedMigrationProduct TMF entity
CREATE TABLE "failedMigrationProduct" ("name" text, "description" text, "solutionType" text, "status" text, "migrationStatus" text, "createdByName" text, "createdDate" timestamp(0) with time zone, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- ============================================================
-- 1867 Scenario Candidate entities (pre-filtered at SQL view level)
-- These map to views that return Solutions linked to baskets for each scenario.
-- ============================================================

CREATE TYPE "Solution1867FibreVoice" AS ("solutionId" text, "solutionName" text, "solutionCreatedDate" timestamp(0) with time zone, "solutionDefinitionName" text, "isFibreService" boolean, "isVoiceService" boolean, "hasESMS" boolean, "isESMSService" boolean, "isMobileSolution" boolean, "basketId" text, "basketName" text, "basketStageUI" text, "basketStatus" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);
CREATE TABLE "solution1867FibreVoice" ("solutionId" text, "solutionName" text, "solutionCreatedDate" timestamp(0) with time zone, "solutionDefinitionName" text, "isFibreService" boolean, "isVoiceService" boolean, "hasESMS" boolean, "isESMSService" boolean, "isMobileSolution" boolean, "basketId" text, "basketName" text, "basketStageUI" text, "basketStatus" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

CREATE TYPE "Solution1867FibreOnly" AS ("solutionId" text, "solutionName" text, "solutionCreatedDate" timestamp(0) with time zone, "solutionDefinitionName" text, "isFibreService" boolean, "isVoiceService" boolean, "hasESMS" boolean, "isESMSService" boolean, "isMobileSolution" boolean, "basketId" text, "basketName" text, "basketStageUI" text, "basketStatus" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);
CREATE TABLE "solution1867FibreOnly" ("solutionId" text, "solutionName" text, "solutionCreatedDate" timestamp(0) with time zone, "solutionDefinitionName" text, "isFibreService" boolean, "isVoiceService" boolean, "hasESMS" boolean, "isESMSService" boolean, "isMobileSolution" boolean, "basketId" text, "basketName" text, "basketStageUI" text, "basketStatus" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

CREATE TYPE "Solution1867MobileEsms" AS ("solutionId" text, "solutionName" text, "solutionCreatedDate" timestamp(0) with time zone, "solutionDefinitionName" text, "isFibreService" boolean, "isVoiceService" boolean, "hasESMS" boolean, "isESMSService" boolean, "isMobileSolution" boolean, "basketId" text, "basketName" text, "basketStageUI" text, "basketStatus" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);
CREATE TABLE "solution1867MobileEsms" ("solutionId" text, "solutionName" text, "solutionCreatedDate" timestamp(0) with time zone, "solutionDefinitionName" text, "isFibreService" boolean, "isVoiceService" boolean, "hasESMS" boolean, "isESMSService" boolean, "isMobileSolution" boolean, "basketId" text, "basketName" text, "basketStageUI" text, "basketStatus" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

CREATE TYPE "Solution1867AccessVoice" AS ("solutionId" text, "solutionName" text, "solutionCreatedDate" timestamp(0) with time zone, "solutionDefinitionName" text, "isFibreService" boolean, "isVoiceService" boolean, "hasESMS" boolean, "isESMSService" boolean, "isMobileSolution" boolean, "basketId" text, "basketName" text, "basketStageUI" text, "basketStatus" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);
CREATE TABLE "solution1867AccessVoice" ("solutionId" text, "solutionName" text, "solutionCreatedDate" timestamp(0) with time zone, "solutionDefinitionName" text, "isFibreService" boolean, "isVoiceService" boolean, "hasESMS" boolean, "isESMSService" boolean, "isMobileSolution" boolean, "basketId" text, "basketName" text, "basketStageUI" text, "basketStatus" text, "href" text, "id" text, "@type" text, "@baseType" text, "@schemaLocation" text);

-- ============================================================
-- Remediation Task Entity (persistent tracking of fix operations)
-- NOTE: Deprecated - Use serviceProblem (TMF656) instead
-- Keeping for backward compatibility until Docker rebuild
-- ============================================================

CREATE TYPE "RemediationTask" AS (
  "id" text,
  "href" text,
  "@type" text,
  "@baseType" text,
  "@schemaLocation" text,
  "solutionId" text,
  "solutionName" text,
  "module" text,
  "status" text,
  "jobId" text,
  "createdAt" timestamp with time zone,
  "updatedAt" timestamp with time zone,
  "resultMessage" text
);

-- remediationTask: Indexed by solutionId (one record per solution)
-- Each solution has one remediation record that gets updated on each fix attempt
CREATE TABLE "remediationTask" (
  "solutionId" text PRIMARY KEY,
  "id" text,
  "href" text,
  "@type" text DEFAULT 'RemediationTask',
  "@baseType" text DEFAULT 'Task',
  "@schemaLocation" text,
  "solutionName" text,
  "module" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "jobId" text,
  "createdAt" timestamp with time zone DEFAULT NOW(),
  "updatedAt" timestamp with time zone DEFAULT NOW(),
  "resultMessage" text
);