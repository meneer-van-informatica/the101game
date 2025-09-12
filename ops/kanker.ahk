^c::  ; Ctrl + C als trigger voor het script
{
    ; Sla de huidige klembordinhoud op
    ClipSaved := ClipboardAll
    Clipboard := ""  ; Maak het klembord leeg zodat we zeker zijn dat het nieuwe gekopieerde item wordt opgehaald
    
    ; Wacht even zodat het klembord geladen is
    ClipWait, 2
    
    ; Controleer of het klembord niet leeg is
    if (Clipboard != "")
    {
        ; Zet focus naar de remote console (met Alt + Tab)
        Send, !{Tab}  ; Alt + Tab schakelt naar het volgende venster
        Sleep, 300  ; Wacht een beetje om zeker te zijn dat de console actief is
        
        ; Typ de klembordtekst letter voor letter
        Loop, parse, Clipboard  ; Doorloop het klembord teken voor teken
        {
            Send, %A_LoopField%  ; Typ het teken
            Sleep, 50  ; Voeg een kleine vertraging toe tussen de letters (voor "typende" effect)
        }
        
        ; Druk op Enter om het commando uit te voeren
        Send, {Enter}
        
        ; Terug naar het originele venster (Alt + Tab)
        Send, !{Tab}
    }
    
    ; Zet het originele klembord terug
    Clipboard := ClipSaved
    return
}
