document.addEventListener("DOMContentLoaded", () => {
  // Extract the product ID from the query string
  const params = new URLSearchParams(window.location.search);
  const productId = params.get("id");

  let listedPrice = 0; // Declare listedPrice globally

  if (!productId) {
    document.getElementById("product-container").innerHTML =
      "<p>Invalid product ID.</p>";
    return;
  }

  // Fetch product details by ID
  fetch(`http://localhost:3000/api/products/${productId}`)
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        const product = data.data;
        listedPrice = parseFloat(product.price);

        // Dynamically fill in product details
        document.getElementById("product-title").textContent = product.title;
        document.getElementById(
          "product-price"
        ).textContent = `₹${product.price}`;
        document.getElementById("product-condition").textContent =
          product.condition1;
        document.getElementById("product-description").textContent =
          product.description;
        document.getElementById("product-size").textContent =
          product.size || "N/A";
        document.getElementById("product-gender").textContent =
          product.gender || "N/A";
        document.getElementById("product-material").textContent =
          product.material || "N/A";
        document.getElementById("product-image").src = product.image_url;
        document.getElementById("product_id").value = productId;

        if (product.image_url) {
          document.getElementById("product-image").alt = product.title;
        }

        // ✅ **Check Product Status**
        const cartButtonsContainer = document.querySelector(
          ".product-cart-thumb"
        );
        if (product.status === "Sold") {
          cartButtonsContainer.innerHTML =
            "<p class='text-danger' style='font-size: 18px; font-weight: bold;'>Product Out of Stock</p>";
        }

        // ✅ Ensure the element exists before attaching an event listener
        const offerAmountInput = document.getElementById("offer-amount");
        if (offerAmountInput) {
          offerAmountInput.addEventListener("input", function () {
            validateOfferAmount(listedPrice);
          });
        }
      } else {
        document.getElementById("product-container").innerHTML =
          "<p>Product not found.</p>";
      }
    })
    .catch((error) => {
      console.error("Error fetching product details:", error);
      document.getElementById("product-container").innerHTML =
        "<p>An error occurred while fetching the product details.</p>";
    });

  // Function to validate the offer amount
  function validateOfferAmount(listedPrice) {
    const offerAmountInput = document.getElementById("offer-amount");
    const errorText = document.getElementById("offer-error");
    const makeOfferBtn = document.getElementById("submit-offer");

    if (!offerAmountInput) return; // Prevents error if element doesn't exist

    const offerAmount = parseFloat(offerAmountInput.value);

    if (isNaN(offerAmount) || offerAmount <= 0) {
      errorText.textContent = "The price should be greater than 0.";
      makeOfferBtn.disabled = true;
    } else if (offerAmount >= listedPrice) {
      errorText.textContent =
        "The price should be lower than the listing price.";
      makeOfferBtn.disabled = true;
    } else {
      errorText.textContent = ""; // Clear the error message
      makeOfferBtn.disabled = false;
    }
  }

  // Handle "Make Offer" button click

  document.getElementById("make-offer-btn").addEventListener("click", () => {
    document.getElementById("offer-modal").style.display = "block"; // Show the modal
  });

  // Handle offer submission

  document.getElementById("submit-offer").addEventListener("click", () => {
    const offerAmount = document.getElementById("offer-amount").value;

    const offerMessage = document.getElementById("offer-message").value;

    const productId = document.getElementById("product_id").value;

    // if (!offerAmount || isNaN(offerAmount) || offerAmount <= 0) {

    //   alert("Please enter a valid offer amount.");

    //   return;

    // }

    //fetch request for negotiation

    fetch("http://localhost:3000/api/products/make-offer", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      credentials: "include", // Ensures cookies (session) are sent

      body: JSON.stringify({
        product_id: productId,

        offer_amount: offerAmount,

        offer_message: offerMessage,
      }),
    })
      .then((response) => response.json())

      .then((data) => {
        alert(data.message);
      })

      .catch((error) => {
        console.error("Error:", error);
      });
  });

  // Close modal when clicking the close button

  document.getElementById("close-modal").addEventListener("click", () => {
    document.getElementById("offer-modal").style.display = "none";
  });
});
