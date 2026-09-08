<#
Automated API smoke tests for the backend (fornecedores and insumos CRUD).
Usage (PowerShell):
  cd backend
  .\scripts\run_api_tests.ps1 -Port 24510

The script will:
 - Create a fornecedor with unique CNPJ
 - Update it
 - Delete it
 - Create an insumo with unique name
 - Update it
 - Delete it

It returns exit code 0 on success or >0 on failure.
#>
param(
    [int]$Port = 24510,
    [int]$TimeoutSeconds = 10
)

$BaseUrl = "http://localhost:$Port"
Write-Host "Running API tests against $BaseUrl"

function Fail([string]$msg, [int]$code=1) {
    Write-Error $msg
    exit $code
}

function HttpGet($path) {
    $uri = "$BaseUrl$path"
    try {
        return Invoke-RestMethod -Uri $uri -Method Get -TimeoutSec $TimeoutSeconds
    } catch {
        Fail "GET $uri failed: $($_.Exception.Message)"
    }
}

function HttpPostForm($path, $form) {
    $uri = "$BaseUrl$path"
    try {
        return Invoke-RestMethod -Uri $uri -Method Post -Body $form -ContentType 'application/x-www-form-urlencoded' -TimeoutSec $TimeoutSeconds
    } catch {
        Fail "POST $uri failed: $($_.Exception.Message)"
    }
}

# Keep track of created resources for cleanup
$createdFornecedorId = $null
$createdInsumoId = $null

try {
    Write-Host "\n== Fornecedores CRUD =="
    $fornecedores = HttpGet "/fornecedores/json"
    Write-Host "Found $(($fornecedores | Measure-Object).Count) fornecedores"

    $timestamp = [int][double]::Parse((Get-Date -UFormat %s))
    $cnpj = "00011122233-auto-$timestamp"
    $createForm = @{ nomeEmpresa = "ACME Test Automation"; cnpjCpf = $cnpj; email = "acme.auto+$timestamp@example.com" }

    Write-Host "Creating fornecedor with CNPJ $cnpj"
    $resp = HttpPostForm "/fornecedores" $createForm
    if ($null -eq $resp -or $resp.status -ne 'success') { Fail "Failed to create fornecedor" }
    Write-Host "Created fornecedor: status= $($resp.status)"

    Start-Sleep -Seconds 1
    $all = HttpGet "/fornecedores/json"
    $created = $all | Where-Object { $_.cnpjCpf -eq $cnpj } | Select-Object -First 1
    if ($null -eq $created) { Fail "Created fornecedor not found in list" }
    $createdFornecedorId = $created.id
    Write-Host "Created fornecedor id: $createdFornecedorId"

    # Update
    Write-Host "Updating fornecedor id $createdFornecedorId"
    $updateForm = @{ nomeEmpresa = "ACME Updated Automation"; nomeFantasia = "ACME AUTO"; cnpjCpf = $cnpj; email = "acme.updated+$timestamp@example.com" }
    $up = HttpPostForm "/fornecedores/atualizar/$createdFornecedorId" $updateForm
    if ($null -eq $up -or $up.status -ne 'success') { Fail "Failed to update fornecedor $createdFornecedorId" }
    Write-Host "Updated fornecedor: status= $($up.status)"

    Start-Sleep -Seconds 1
    $verify = HttpGet "/fornecedores/json" | Where-Object { $_.id -eq $createdFornecedorId } | Select-Object -First 1
    if ($null -eq $verify -or $verify.nome -notlike '*Updated*') { Fail "Update verification failed for fornecedor $createdFornecedorId" }
    Write-Host "Verified fornecedor update: name = $($verify.nome)"

    # Delete
    Write-Host "Deleting fornecedor id $createdFornecedorId"
    $del = HttpGet "/fornecedores/deletar/$createdFornecedorId"
    if ($null -eq $del -or $del.status -ne 'success') { Fail "Failed to delete fornecedor $createdFornecedorId" }
    Write-Host "Deleted fornecedor: status= $($del.status)"

    Start-Sleep -Seconds 1
    $checkAfterDel = HttpGet "/fornecedores/json" | Where-Object { $_.id -eq $createdFornecedorId }
    if ($checkAfterDel) { Fail "Fornecedor $createdFornecedorId still present after delete" }
    Write-Host "Fornecedor deletion confirmed"

    Write-Host "\n== Insumos CRUD =="
    $insumosList = HttpGet "/insumos/json"
    Write-Host "Retrieved insumos (count: $((($insumosList.insumos) | Measure-Object).Count))"

    $insumoName = "TestInsumoAuto-$timestamp"
    $createInsumoForm = @{ nome = $insumoName; unidadeMedidaId = 1; preco = 9.99 }

    Write-Host "Creating insumo $insumoName"
    $respI = HttpPostForm "/insumos" $createInsumoForm
    if ($null -eq $respI -or $respI.status -ne 'success') { Fail "Failed to create insumo" }
    Write-Host "Created insumo: status= $($respI.status)"

    Start-Sleep -Seconds 1
    $insumosAll = HttpGet "/insumos/json"
    $createdI = ($insumosAll.insumos) | Where-Object { $_.nome -eq $insumoName } | Select-Object -First 1
    if ($null -eq $createdI) { Fail "Created insumo not found" }
    $createdInsumoId = $createdI.id
    Write-Host "Created insumo id: $createdInsumoId"

    # Update insumo
    Write-Host "Updating insumo id $createdInsumoId"
    $updateInsumoForm = @{ nome = "$insumoName-Updated"; unidadeMedidaId = 1; preco = 19.95; isEmbalagem = 'false' }
    $upI = HttpPostForm "/insumos/atualizar/$createdInsumoId" $updateInsumoForm
    if ($null -eq $upI -or $upI.status -ne 'success') { Fail "Failed to update insumo $createdInsumoId" }
    Write-Host "Updated insumo: status= $($upI.status)"

    Start-Sleep -Seconds 1
    $verifyI = (HttpGet "/insumos/json").insumos | Where-Object { $_.id -eq $createdInsumoId } | Select-Object -First 1
    if ($null -eq $verifyI -or $verifyI.nome -notlike '*Updated*') { Fail "Update verification failed for insumo $createdInsumoId" }
    Write-Host "Verified insumo update: name = $($verifyI.nome)"

    # Delete insumo
    Write-Host "Deleting insumo id $createdInsumoId"
    $delI = HttpGet "/insumos/deletar/$createdInsumoId"
    if ($null -eq $delI -or $delI.status -ne 'success') { Fail "Failed to delete insumo $createdInsumoId" }
    Write-Host "Deleted insumo: status= $($delI.status)"

    Start-Sleep -Seconds 1
    $checkInsAfterDel = (HttpGet "/insumos/json").insumos | Where-Object { $_.id -eq $createdInsumoId }
    if ($checkInsAfterDel) { Fail "Insumo $createdInsumoId still present after delete" }
    Write-Host "Insumo deletion confirmed"

    Write-Host "\nAll automated API CRUD tests passed. ✅"
    exit 0
}
catch {
    Write-Error "Exception during tests: $($_.Exception.Message)"
    # Attempt cleanup
    if ($createdFornecedorId) {
        try { HttpGet "/fornecedores/deletar/$createdFornecedorId" | Out-Null } catch {}
    }
    if ($createdInsumoId) {
        try { HttpGet "/insumos/deletar/$createdInsumoId" | Out-Null } catch {}
    }
    exit 2
}