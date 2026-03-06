"""
Generate Apex batch scripts for 1147 remediation
"""
from typing import Literal


def generate_apex_script(
    solution_id: str, 
    action: Literal["DELETE", "MIGRATE", "UPDATE"]
) -> str:
    """
    Generate Apex batch script for 1147 remediation.
    
    Args:
        solution_id: Salesforce Solution ID (e.g., 'a242r000002vWPsAAM')
        action: One of DELETE, MIGRATE, UPDATE
    
    Returns:
        Apex script ready for execution
    """
    
    if action == "DELETE":
        return f"""
// DELETE FROM HEROKU - Solution: {solution_id}
Boolean autoRun = false;
Boolean premac = false;
Map<Id, csord__Solution__c> solutionMap = new Map<Id, csord__Solution__c>([
    SELECT Id, cssdm__solution_definition__c
    FROM csord__Solution__c
    WHERE cssdm__solution_definition__c != null 
    AND Is_Migrated_to_Heroku__c = false 
    AND csord__External_Identifier__c = 'Not Migrated Successfully' 
    AND Id = '{solution_id}'
]);

if (solutionMap.isEmpty()) {{
    System.debug('No solution found matching criteria for DELETE');
}} else {{
    DeleteSolutionBatch deleteSolutions = new DeleteSolutionBatch(
        solutionMap.KeySet(), autoRun, premac
    );
    Id batchId = Database.executeBatch(deleteSolutions, 10);
    System.debug('DELETE batch started: ' + batchId);
}}
"""
    
    elif action == "MIGRATE":
        return f"""
// MIGRATE TO HEROKU - Solution: {solution_id}
Map<Id, Id> solutionAndSolutionDefinitionIdMap = new Map<Id, Id>();
Boolean autoRun = false;
Boolean premac = false;
Map<Id, csord__Solution__c> solutionMap = new Map<Id, csord__Solution__c>([
    SELECT Id, cssdm__solution_definition__c
    FROM csord__Solution__c
    WHERE cssdm__solution_definition__c != null 
    AND Is_Migrated_to_Heroku__c = false 
    AND csord__External_Identifier__c != 'Not Migrated Successfully' 
    AND Id = '{solution_id}'
]);

if (solutionMap.isEmpty()) {{
    System.debug('No solution found matching criteria for MIGRATE');
}} else {{
    for(csord__Solution__c solution : solutionMap.Values()) {{
        solutionAndSolutionDefinitionIdMap.put(
            solution.Id, 
            solution.cssdm__solution_definition__c
        );
    }}
    MigrateSubscriptionsBatch migrateSubscriptions = new MigrateSubscriptionsBatch(
        solutionAndSolutionDefinitionIdMap, autoRun, premac
    );
    Id batchId = Database.executeBatch(migrateSubscriptions, 10);
    System.debug('MIGRATE batch started: ' + batchId);
}}
"""
    
    elif action == "UPDATE":
        return f"""
// UPDATE CONFIGURATIONS TO HEROKU - Solution: {solution_id}
Boolean autoRun = false;
Map<Id, csord__Solution__c> solutionMap = new Map<Id, csord__Solution__c>([
    SELECT Id
    FROM csord__Solution__c
    WHERE cssdm__solution_definition__c != null 
    AND Is_Migrated_to_Heroku__c = true 
    AND Is_Configuration_Updated_To_Heroku__c = false 
    AND Id = '{solution_id}'
]);

if (solutionMap.isEmpty()) {{
    System.debug('No solution found matching criteria for UPDATE');
}} else {{
    UpdateConfigurationsToHerokuBatch updateConfigurationsToHeroku = new UpdateConfigurationsToHerokuBatch(
        solutionMap.KeySet(), autoRun
    );
    Id batchId = Database.executeBatch(updateConfigurationsToHeroku, 1);
    System.debug('UPDATE batch started: ' + batchId);
}}
"""
    
    else:
        raise ValueError(f"Unknown action: {action}")









