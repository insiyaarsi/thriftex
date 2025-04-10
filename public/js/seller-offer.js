document.addEventListener("DOMContentLoaded", async () => {
  async function fetchOffers() {
    try {
      const response = await fetch("/offers/seller");
      const data = await response.json();

      if (!data.success) {
        console.error("Error fetching offers:", data.message);
        return;
      }

      console.log("Fetched Data:", data);

      const newOffersContainer = document.getElementById("newOffers");
      const ongoingOffersContainer = document.getElementById("ongoingOffers");

      newOffersContainer.innerHTML = "";
      ongoingOffersContainer.innerHTML = "";

      data.newOffers.forEach((offer) => {
        const offerRow = document.createElement("tr");
        offerRow.innerHTML = `
        <td><img src="${offer.image_url}" alt="${
          offer.title
        }" style="width: 50px; height: 64px; object-fit: cover; border-radius: 5px;"></td>
                  <td>${offer.buyer_username}</td>
                  <td>${offer.title}</td>
                  <td>${offer.category}</td>
                   <td>₹${(parseFloat(offer.offer_amount) || 0).toFixed(2)}</td>
                  <td>${offer.status}</td>
                  <td style="width: 25%;">${
                    offer.offer_message || "—"
                  }</td> <!-- Display Message -->
                  <td>
                      <button class="btn btn-success btn-sm accept-btn" data-id="${
                        offer.id
                      }">Accept</button>
                      <button class="btn btn-danger btn-sm reject-btn" data-id="${
                        offer.id
                      }">Reject</button>
                      <button class="btn btn-warning btn-sm counter-btn" data-id="${
                        offer.id
                      }" data-price="${offer.offer_amount}">Counter</button>
                  </td>
              `;
        newOffersContainer.appendChild(offerRow);
      });

      data.ongoingOffers.forEach((offer) => {
        const offerRow = document.createElement("tr");
        offerRow.innerHTML = `
        <td><img src="${offer.image_url}" alt="${
          offer.title
        }" style="width: 50px; height: 64px; object-fit: cover; border-radius: 5px;"></td>
                  <td>${offer.buyer_username}</td>
                  <td>${offer.title}</td>
                  <td>${offer.category}</td>
                  <td>₹${(parseFloat(offer.offer_amount) || 0).toFixed(2)}</td>
                  <td>${offer.status}</td>
                  <td style="width: 25%;">${
                    offer.offer_message || "—"
                  }</td> <!-- Display Message -->
              `;
        ongoingOffersContainer.appendChild(offerRow);
      });

      attachEventListeners();
    } catch (error) {
      console.error("Error fetching offers:", error);
    }
  }

  function attachEventListeners() {
    document.querySelectorAll(".accept-btn").forEach((button) => {
      button.removeEventListener("click", handleAcceptOffer); // Prevent duplicate listeners
      button.addEventListener("click", handleAcceptOffer);
    });

    document.querySelectorAll(".reject-btn").forEach((button) => {
      button.addEventListener("click", async (event) => {
        const offerId = event.target.getAttribute("data-id");
        await rejectOffer(offerId);
      });
    });

    document.querySelectorAll(".counter-btn").forEach((button) => {
      button.addEventListener("click", (event) => {
        const offerId = event.target.getAttribute("data-id");
        openCounterModal(offerId);
      });
    });
  }

  async function handleAcceptOffer(event) {
    const offerId = event.target.getAttribute("data-id");
    if (!offerId) return;

    const confirmation = confirm("Are you sure you want to accept this offer?");
    if (!confirmation) return;

    const button = event.target;
    button.disabled = true;
    button.textContent = "Processing...";

    try {
      const response = await fetch(`/offers/accept/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();

      if (data.success) {
        alert("Offer accepted successfully.");

        // Update UI: Mark the listing as 'Sold'
        const offerRow = button.closest(".offer-row");
        if (offerRow) {
          offerRow.querySelector(".offer-status").textContent = "Accepted";
        }

        // Disable the button after acceptance
        button.textContent = "Accepted";
        button.disabled = true;

        fetchOffers(); // Refresh the offers list
      } else {
        alert(data.message);
        button.disabled = false;
        button.textContent = "Accept";
      }
    } catch (error) {
      console.error("Error accepting offer:", error);
      alert("An error occurred. Please try again.");
      button.disabled = false;
      button.textContent = "Accept";
    }
  }

  async function rejectOffer(offerId) {
    try {
      const response = await fetch(`/offers/reject/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (data.success) {
        alert("Offer rejected successfully.");
        fetchOffers();
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error("Error rejecting offer:", error);
    }
  }

  async function openCounterModal(offerId) {
    const modal = document.getElementById("counterModal");
    modal.style.display = "block";

    const counterAmountInput = document.getElementById("counterAmount");
    const errorText = document.getElementById("counterError");
    const submitButton = document.getElementById("submitCounter");

    errorText.textContent = "";
    submitButton.disabled = true;

    try {
      const response = await fetch(`/offers/original-price/${offerId}`);
      const data = await response.json();

      if (!data.success) {
        console.error("Error fetching original price:", data.message);
        return;
      }

      const originalPrice = parseFloat(data.originalPrice) || 0;
      document.getElementById("offer_id").value = offerId;

      counterAmountInput.addEventListener("input", () => {
        const counterValue = parseFloat(counterAmountInput.value);

        if (isNaN(counterValue) || counterValue <= 0) {
          errorText.textContent = "The price should be greater than 0.";
          submitButton.disabled = true;
        } else if (counterValue >= originalPrice) {
          errorText.textContent = `The price should be lower than the original listing price of ₹${originalPrice.toFixed(
            2
          )}.`;
          submitButton.disabled = true;
        } else {
          errorText.textContent = "";
          submitButton.disabled = false;
        }
      });
    } catch (error) {
      console.error("Error fetching listing price:", error);
    }
  }

  document.getElementById("closeCounterModal").addEventListener("click", () => {
    document.getElementById("counterModal").style.display = "none";
  });

  document
    .getElementById("submitCounter")
    .addEventListener("click", async () => {
      const offerId = document.getElementById("offer_id").value;
      const counterAmount = parseFloat(
        document.getElementById("counterAmount").value
      );
      const message = document.getElementById("counter-message").value;

      if (isNaN(counterAmount) || counterAmount <= 0) {
        document.getElementById("counterError").textContent =
          "The price should be greater than 0.";
        return;
      }

      try {
        const response = await fetch(`/offers/counter/${offerId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            counterAmount,
            message,
            last_updated_by: "seller",
          }),
        });
        const data = await response.json();
        if (data.success) {
          alert("Counteroffer sent successfully.");
          document.getElementById("counterModal").style.display = "none";
          fetchOffers();
        } else {
          alert(data.message);
        }
      } catch (error) {
        console.error("Error sending counteroffer:", error);
      }
    });

  fetchOffers();
});
