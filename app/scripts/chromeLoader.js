$(document).ready(function () {
    renderChrome();
});

function chromeLoaded() {

    $("body").show();
}

//Function to prepare the options and render the control
function renderChrome() {
    // The Help, Account and Contact pages receive the 
    //   same query string parameters as the main page
    var options = {
        "appTitle": "Chrome control app",
        "onCssLoaded": "chromeLoaded()",
        "settingsLinks": [{
            "linkUrl": "Account.html?" + document.URL.split("?")[1],
            "displayName": "Account settings"
        }, {
            "linkUrl": "Contact.html?" + document.URL.split("?")[1],
            "displayName": "Contact us"
        }]
    }, nav;

    nav = new SP.UI.Controls.Navigation(
        "chrome_ctrl_placeholder",
        options
    );
    nav.setVisible(true);
}