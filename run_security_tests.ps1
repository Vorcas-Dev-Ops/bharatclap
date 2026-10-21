$tokenA = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjU5NmYwZWQ3LTdmMjUtNDUzYS1hZDc1LTQxYWEzNDdmMWRiOSIsInRva2VuX3ZlcnNpb24iOjAsInJvbGUiOiJjdXN0b21lciIsImlhdCI6MTc5MDgzODYwNSwiZXhwIjoxNzkwODQwNDA1fQ.KnyGhiJ4EGv48sU0nOUZGX4sbqZVSVL1pvQGn0mlKhc'
$tokenB = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImYzY2VjMWVkLTFkODktNDkxMS04ZjE4LTI5MjNiZDc3ZDI3NCIsInRva2VuX3ZlcnNpb24iOjAsInJvbGUiOiJjdXN0b21lciIsImlhdCI6MTc5MDgzODY3NCwiZXhwIjoxNzkwODQwNDc0fQ.x-ws2SIdn1zGd3k74bT025IgnG9tMzDLRHni6wV7UsM'

function Call-Api {
    param(
        [string]$Name,
        [string]$Uri,
        [hashtable]$Headers,
        [string]$Method = 'GET',
        [string]$Body = $null
    )
    Write-Host "`n----------------------------------------"
    Write-Host "TEST: $Name"
    Write-Host "METHOD: $Method $Uri"
    try {
        $params = @{
            Uri = $Uri
            Method = $Method
            Headers = $Headers
            UseBasicParsing = $true
        }
        if ($Body) {
            $params['Body'] = $Body
            $params['ContentType'] = 'application/json'
        }
        $resp = Invoke-WebRequest @params
        Write-Host "STATUS: $($resp.StatusCode)"
        Write-Host "BODY: $($resp.Content)"
        return @{ Status = $resp.StatusCode; Body = $resp.Content }
    } catch {
        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $bodyText = $reader.ReadToEnd()
            Write-Host "STATUS: $status"
            Write-Host "BODY: $bodyText"
            return @{ Status = $status; Body = $bodyText }
        } else {
            Write-Host "ERROR: $($_.Exception.Message)"
            return @{ Status = 0; Body = $_.Exception.Message }
        }
    }
}

# --- TEST A-05: Modified JWT ---
# Tamper with signature: change last characters of tokenA
$modifiedToken = $tokenA.Substring(0, $tokenA.Length - 5) + "XXXXX"
Call-Api -Name "A-05: Modified JWT (Tampered Signature)" `
         -Uri "http://localhost:5000/api/cart" `
         -Headers @{ Authorization = "Bearer $modifiedToken" }

# --- TEST A-06: Expired JWT ---
# Fabricate a token with exp in the past (e.g., year 2020)
# Payload: {"id":"596f0ed7-7f25-453a-ad75-41aa347f1db9","role":"customer","iat":1577836800,"exp":1577840400}
# Base64url header: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
# Base64url payload: eyJpZCI6IjU5NmYwZWQ3LTdmMjUtNDUzYS1hZDc1LTQxYWEzNDdmMWRiOSIsInJvbGUiOiJjdXN0b21lciIsImlhdCI6MTU3NzgzNjgwMCwiZXhwIjoxNTc3ODQwNDAwfQ
$expiredPayload = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes('{"id":"596f0ed7-7f25-453a-ad75-41aa347f1db9","role":"customer","iat":1577836800,"exp":1577840400}')).Replace('+', '-').Replace('/', '_').TrimEnd('=')
$expiredToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.$expiredPayload.invalidSignatureOrExpired"
Call-Api -Name "A-06: Expired JWT" `
         -Uri "http://localhost:5000/api/cart" `
         -Headers @{ Authorization = "Bearer $expiredToken" }

# --- TEST A-09: Internal Service Key Abuse via Gateway ---
# Attempt to call internal endpoint through API gateway using x-internal-service-key header
Call-Api -Name "A-09: Internal service-key abuse (via Gateway)" `
         -Uri "http://localhost:5000/api/bookings/admin/all" `
         -Headers @{ "x-internal-service-key" = "bharatclap_internal_secret_key_2026_production" }

Call-Api -Name "A-09: Internal service-key abuse on customer endpoint without JWT" `
         -Uri "http://localhost:5000/api/cart" `
         -Headers @{ "x-internal-service-key" = "bharatclap_internal_secret_key_2026_production" }

# --- TEST CART OWNERSHIP ISOLATION ---
# 1. Customer A adds item to cart
$addItemBody = '{"subservice_id":"88c8cd5c-4f26-47d1-a5bf-52d75ad1efa0","quantity":1}'
Call-Api -Name "Cart: Customer A adds item" `
         -Uri "http://localhost:5000/api/cart/add" `
         -Headers @{ Authorization = "Bearer $tokenA" } `
         -Method "POST" `
         -Body $addItemBody

# 2. Customer A checks cart
Call-Api -Name "Cart: Customer A views cart" `
         -Uri "http://localhost:5000/api/cart" `
         -Headers @{ Authorization = "Bearer $tokenA" }

# 3. Customer B checks cart
Call-Api -Name "Cart: Customer B views cart (must be empty/isolated)" `
         -Uri "http://localhost:5000/api/cart" `
         -Headers @{ Authorization = "Bearer $tokenB" }

# 4. Customer B tries to clear or remove Customer A's item (there is no cart ID parameter, user is derived strictly from JWT)
Write-Host "`n=== SUMMARY COMPLETE ==="
