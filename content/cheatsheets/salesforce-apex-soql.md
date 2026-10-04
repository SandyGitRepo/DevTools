---
title: Salesforce Apex / SOQL
owner: DevToolkit maintainers
reviewed: 2026-10-04
version: API v61.0
tags: [salesforce, crm, apex, soql]
sources: [developer.salesforce.com/docs]
---

Apex and SOQL patterns that stay within governor limits.

## SOQL basics

- Select only the fields you need; there is no `SELECT *`
- Bind Apex variables with `:` — this also prevents SOQL injection
- Use relationship queries instead of queries in loops

```apex
String city = 'Pune';
List<Account> accounts = [
    SELECT Id, Name, BillingCity, (SELECT Id, LastName FROM Contacts)
    FROM Account
    WHERE BillingCity = :city AND CreatedDate = LAST_N_DAYS:30
    ORDER BY Name
    LIMIT 200
];
```

## Aggregates and dates

- `COUNT`, `SUM`, `MAX` return `AggregateResult`
- Date literals: `TODAY`, `THIS_MONTH`, `LAST_N_DAYS:n`, `THIS_FISCAL_QUARTER`
- `GROUP BY` with `HAVING` filters aggregates

```apex
for (AggregateResult ar : [
        SELECT StageName stage, COUNT(Id) total, SUM(Amount) value
        FROM Opportunity
        WHERE CloseDate = THIS_FISCAL_QUARTER
        GROUP BY StageName
        HAVING SUM(Amount) > 100000]) {
    System.debug(ar.get('stage') + ': ' + ar.get('total'));
}
```

## Bulkify

- Triggers receive up to 200 records — never query or DML inside a loop
- Collect IDs in a `Set`, query once, then map
- Use `Map<Id, SObject>` for fast lookups

```apex
Set<Id> accountIds = new Set<Id>();
for (Contact c : Trigger.new) accountIds.add(c.AccountId);

Map<Id, Account> accounts = new Map<Id, Account>([
    SELECT Id, OwnerId FROM Account WHERE Id IN :accountIds
]);

for (Contact c : Trigger.new) {
    Account a = accounts.get(c.AccountId);
    if (a != null) c.OwnerId = a.OwnerId;
}
```

## Trigger handler pattern

- One trigger per object; delegate logic to a handler class
- Keep triggers logic-free so they are easy to test
- Guard against recursion with a static flag

```apex
trigger ContactTrigger on Contact (before insert, before update) {
    ContactTriggerHandler.handle(Trigger.new, Trigger.oldMap, Trigger.operationType);
}

public with sharing class ContactTriggerHandler {
    public static void handle(List<Contact> records, Map<Id, Contact> oldMap, System.TriggerOperation op) {
        switch on op {
            when BEFORE_INSERT, BEFORE_UPDATE { normalisePhones(records); }
        }
    }
    static void normalisePhones(List<Contact> records) {
        for (Contact c : records) if (c.Phone != null) c.Phone = c.Phone.replaceAll('[^0-9+]', '');
    }
}
```

## Security

- Declare `with sharing` to respect record access
- `WITH USER_MODE` enforces field- and object-level security in SOQL
- `Security.stripInaccessible` cleans records before DML or returning to UI

```apex
List<Account> rows = [SELECT Id, Name, AnnualRevenue FROM Account WITH USER_MODE LIMIT 50];

SObjectAccessDecision decision = Security.stripInaccessible(AccessType.READABLE, rows);
List<Account> safe = (List<Account>) decision.getRecords();
```

## DML and errors

- `Database.insert(records, false)` allows partial success
- Inspect `SaveResult` errors instead of failing the whole batch
- Use `Savepoint` to roll back multi-step work

```apex
Database.SaveResult[] results = Database.insert(newContacts, false);
for (Integer i = 0; i < results.size(); i++) {
    if (!results[i].isSuccess()) {
        for (Database.Error e : results[i].getErrors()) System.debug(e.getMessage());
    }
}

Savepoint sp = Database.setSavepoint();
try { update accounts; insert tasks; } catch (DmlException e) { Database.rollback(sp); throw e; }
```

## Async Apex

- `Queueable` for chained jobs with complex types
- `Batchable` for large data volumes (up to 50 million records)
- `@future` only for simple fire-and-forget callouts

```apex
public class RecalcLimitsJob implements Queueable {
    private final Set<Id> accountIds;
    public RecalcLimitsJob(Set<Id> ids) { accountIds = ids; }
    public void execute(QueueableContext ctx) {
        // recalculate in bulk
    }
}

System.enqueueJob(new RecalcLimitsJob(accountIds));
```

## Key governor limits (synchronous)

- 100 SOQL queries, 50,000 rows returned
- 150 DML statements, 10,000 rows processed
- 10 s CPU time, 6 MB heap — check with the `Limits` class

```apex
System.debug('Queries: ' + Limits.getQueries() + ' / ' + Limits.getLimitQueries());
System.debug('CPU ms: ' + Limits.getCpuTime() + ' / ' + Limits.getLimitCpuTime());
```

## Tests

- 75 % coverage is the minimum to deploy — aim for meaningful assertions
- Use `@TestSetup` for shared data and `Test.startTest()` to reset limits
- Never rely on org data (`SeeAllData=false` is the default)

```apex
@IsTest
private class ContactTriggerHandlerTest {
    @TestSetup
    static void setup() { insert new Account(Name = 'Test Co'); }

    @IsTest
    static void normalisesPhone() {
        Account a = [SELECT Id FROM Account LIMIT 1];
        Test.startTest();
        insert new Contact(LastName = 'Rao', AccountId = a.Id, Phone = '+91 98765-43210');
        Test.stopTest();
        Assert.areEqual('+919876543210', [SELECT Phone FROM Contact LIMIT 1].Phone);
    }
}
```
