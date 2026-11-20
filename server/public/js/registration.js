(() => {
  "use strict";

  const root = document.querySelector(".registration-page");
  if (!root) return;

  const form = root.querySelector("form");
  const panels = [...root.querySelectorAll("[data-step-panel]")];
  const indicators = [...root.querySelectorAll("[data-step-indicator]")];

  const backButton = root.querySelector("#registration-back");
  const continueButton = root.querySelector("#registration-continue");
  const submitButton = root.querySelector("#registration-submit");

  const counter = root.querySelector("#step-counter");
  const percentage = root.querySelector("#step-percentage");
  const progressBar = root.querySelector("#progress-bar");
  const progressFill = root.querySelector("#progress-fill");

  if (
    !form ||
    panels.length !== 7 ||
    !backButton ||
    !continueButton ||
    !submitButton
  ) {
    console.error("HOSA registration wizard could not initialize.");
    return;
  }

  const totalSteps = panels.length;
  let currentStep = 1;
  let submitting = false;

  const field = (name) =>
    form.elements.namedItem(name);

  const conditional = (name) =>
    root.querySelector(`[data-conditional="${name}"]`);

  const setConditional = (name, visible, requiredFields = []) => {
    const container = conditional(name);
    if (!container) return;

    container.hidden = !visible;

    container.querySelectorAll("input, select, textarea").forEach((input) => {
      input.disabled = !visible;
      input.required = visible && requiredFields.includes(input.name);
    });
  };

  const updateConditionals = () => {
    const classValue = field("last_class_attended")?.value;
    const schoolStatus = field("school_status")?.value;
    const houseValue = field("school_house")?.value;
    const examinationValue = field("examination_level")?.value;
    const businessValue = field("business_owner")?.value;

    setConditional(
      "class-explanation",
      ["other", "not_sure"].includes(classValue),
      ["last_class_explanation"],
    );

    setConditional(
      "old-student",
      schoolStatus === "old_student",
      ["completion_year"],
    );

    setConditional(
      "current-student",
      schoolStatus === "current_student",
      ["expected_completion_year"],
    );

    setConditional(
      "school-house-other",
      houseValue === "Other",
      ["school_house_other"],
    );

    setConditional(
      "examination-other",
      examinationValue === "other",
      ["examination_level_other"],
    );

    setConditional(
      "business-details",
      businessValue === "yes",
      ["business_name", "business_category"],
    );

    setConditional(
      "town-city-other",
      field("town_city")?.value === "Other",
      ["town_city_other"],
    );

    setConditional(
      "nationality-other",
      field("nationality")?.value === "Other",
      ["nationality_other"],
    );
  };

  const getStep = (element) => {
    const panel = element?.closest("[data-step-panel]");
    return panel ? Number(panel.dataset.stepPanel) : null;
  };

  const clearCustomValidity = () => {
    const admissionYear = field("admission_year");
    const completionYear =
      field("school_status")?.value === "current_student"
        ? field("expected_completion_year")
        : field("completion_year");

    admissionYear?.setCustomValidity("");
    field("completion_year")?.setCustomValidity("");
    field("expected_completion_year")?.setCustomValidity("");

    if (!admissionYear?.value || !completionYear?.value) return;

    if (Number(completionYear.value) < Number(admissionYear.value)) {
      completionYear.setCustomValidity(
        "Completion year cannot be earlier than admission year.",
      );
    }
  };

  const validateInterests = () => {
    const interests = [
      ...form.querySelectorAll('input[name="interests"]:checked'),
    ];

    const firstInterest = form.querySelector('input[name="interests"]');
    if (!firstInterest) return true;

    const existingMessage = root.querySelector("[data-interest-error]");

    if (interests.length > 0) {
      existingMessage?.remove();
      firstInterest.setCustomValidity("");
      return true;
    }

    firstInterest.setCustomValidity("Select at least one area of interest.");

    if (!existingMessage) {
      const message = document.createElement("p");
      message.dataset.interestError = "true";
      message.className = "field-error";
      message.setAttribute("role", "alert");
      message.textContent = "Select at least one area of interest.";

      const interestGroup = firstInterest.closest("fieldset") ||
        firstInterest.closest(".field") ||
        firstInterest.parentElement;

      interestGroup?.append(message);
    }

    return false;
  };

  const validateStep = (stepNumber) => {
    updateConditionals();
    clearCustomValidity();

    const panel = panels.find(
      (item) => Number(item.dataset.stepPanel) === stepNumber,
    );

    if (!panel) return true;

    if (stepNumber === 5 && !validateInterests()) {
      const firstInterest = panel.querySelector('input[name="interests"]');
      firstInterest?.focus();
      return false;
    }

    const controls = [
      ...panel.querySelectorAll(
        "input:not(:disabled), select:not(:disabled), textarea:not(:disabled)",
      ),
    ];

    for (const control of controls) {
      if (!control.checkValidity()) {
        control.reportValidity();
        control.focus();
        return false;
      }
    }

    return true;
  };

  const updateReview = () => {
    const value = (name) => {
      const control = field(name);
      if (!control) return "";

      if (control.type === "checkbox") {
        return control.checked ? "Yes" : "No";
      }

      if (control.tagName === "SELECT") {
        return control.selectedOptions[0]?.textContent.trim() || "";
      }

      return String(control.value || "").trim();
    };

    const rawValue = (name) =>
      String(field(name)?.value || "").trim();

    const resolvedOtherValue = (name) =>
      rawValue(name) === "Other"
        ? rawValue(`${name}_other`)
        : value(name);

    const setReview = (target, text) => {
      const element = root.querySelector(
        `[data-review-target="${target}"]`,
      );

      if (element) {
        element.textContent = text || "Not provided";
      }
    };

    const fullName = [
      value("first_name"),
      value("other_name"),
      value("last_name"),
    ].filter(Boolean).join(" ");

    setReview("full_name", fullName);
    setReview("other_name", value("other_name"));

    setReview("school_status", value("school_status"));
    setReview("admission_year", value("admission_year"));
    setReview("last_class_attended", value("last_class_attended"));

    const completionField =
      field("school_status")?.value === "current_student"
        ? "expected_completion_year"
        : "completion_year";

    setReview("school_completion", value(completionField));
    setReview("school_house", [
      value("school_house"),
      value("school_house") === "Other" ? value("school_house_other") : "",
    ].filter(Boolean).join(" — "));

    setReview("examination_level", [
      value("examination_level"),
      value("examination_level") === "other"
        ? value("examination_level_other")
        : "",
    ].filter(Boolean).join(" — "));

    // Examination index numbers are deliberately never copied into the review.
    setReview(
      "examination_index_number",
      value("examination_index_number")
        ? "Private information provided"
        : "Not provided",
    );

    setReview("email", value("email"));
    setReview("phone", value("phone"));
    setReview("whatsapp_phone", value("whatsapp_phone"));

    setReview(
      "location",
      [resolvedOtherValue("town_city"), value("district")]
        .filter(Boolean)
        .join(", "),
    );

    setReview("nationality", resolvedOtherValue("nationality"));

    setReview("region", value("region"));
    setReview("preferred_contact", value("preferred_contact"));

    setReview("employment_status", value("employment_status"));
    setReview("profession", value("profession"));
    setReview("highest_education", value("highest_education"));
    setReview("specialization", value("specialization"));
    setReview("organization", value("organization"));
    setReview("business_owner", value("business_owner"));

    setReview(
      "business_name",
      value("business_owner") === "Yes" ? value("business_name") : "",
    );

    const selectedInterests = [
      ...form.querySelectorAll('input[name="interests"]:checked'),
    ].map((input) => {
      const label = input.closest("label") ||
        root.querySelector(`label[for="${input.id}"]`);

      return label?.textContent.trim() || input.value;
    });

    setReview(
      "interests",
      selectedInterests.length ? selectedInterests.join(", ") : "None selected",
    );

    setReview("mentor_opt_in", value("mentor_opt_in") === "Yes" ? "Yes" : "No");
    setReview(
      "seeking_mentorship",
      value("seeking_mentorship") === "Yes" ? "Yes" : "No",
    );
    setReview(
      "volunteer_opt_in",
      value("volunteer_opt_in") === "Yes" ? "Yes" : "No",
    );
    setReview(
      "school_project_support",
      value("school_project_support") === "Yes" ? "Yes" : "No",
    );

    setReview("username", value("username"));
  };

  const showStep = (stepNumber, options = {}) => {
    currentStep = Math.min(totalSteps, Math.max(1, stepNumber));

    panels.forEach((panel) => {
      const active = Number(panel.dataset.stepPanel) === currentStep;
      panel.hidden = !active;
      panel.setAttribute("aria-hidden", String(!active));
    });

    indicators.forEach((indicator) => {
      const number = Number(indicator.dataset.stepIndicator);
      const active = number === currentStep;
      const completed = number < currentStep;

      indicator.classList.toggle("is-active", active);
      indicator.classList.toggle("is-complete", completed);

      if (active) {
        indicator.setAttribute("aria-current", "step");
      } else {
        indicator.removeAttribute("aria-current");
      }
    });

    const progress = Math.round((currentStep / totalSteps) * 100);

    if (counter) {
      counter.textContent = `Step ${currentStep} of ${totalSteps}`;
    }

    if (percentage) {
      percentage.textContent = `${progress}%`;
    }

    if (progressFill) {
      progressFill.style.width = `${progress}%`;
    }

    if (progressBar) {
      progressBar.setAttribute("aria-valuenow", String(progress));
    }

    backButton.disabled = currentStep === 1;
    continueButton.hidden = currentStep === totalSteps;
    submitButton.hidden = currentStep !== totalSteps;

    if (currentStep === totalSteps) {
      updateReview();
    }

    if (options.focus !== false) {
      const heading = panels[currentStep - 1]?.querySelector("h2, h3, h4");
      heading?.focus();
    }
  };

  const findServerErrorStep = () => {
    const errorElements = [...root.querySelectorAll(".field-error")];

    for (const errorElement of errorElements) {
      const container = errorElement.closest(".field") ||
        errorElement.closest("fieldset");

      const control = container?.querySelector(
        "input:not(:disabled), select:not(:disabled), textarea:not(:disabled)",
      );

      const step = getStep(control);
      if (step) return step;
    }

    return 1;
  };

  form.addEventListener("input", (event) => {
    const target = event.target;

    if (target.matches("input, select, textarea")) {
      target.setCustomValidity("");
    }

    updateConditionals();

    if (currentStep === totalSteps) {
      updateReview();
    }
  });

  form.addEventListener("change", () => {
    updateConditionals();

    if (currentStep === totalSteps) {
      updateReview();
    }
  });

  continueButton.addEventListener("click", () => {
    if (!validateStep(currentStep)) return;

    showStep(currentStep + 1);
  });

  backButton.addEventListener("click", () => {
    showStep(currentStep - 1);
  });

  root.querySelectorAll("[data-edit-step]").forEach((button) => {
    button.addEventListener("click", () => {
      const requestedStep = Number(button.dataset.editStep);

      if (requestedStep >= 1 && requestedStep <= totalSteps) {
        showStep(requestedStep);
      }
    });
  });

  form.addEventListener("submit", (event) => {
    updateConditionals();
    clearCustomValidity();

    if (!validateInterests()) {
      event.preventDefault();
      showStep(5);
      return;
    }

    const invalidControl = [
      ...form.querySelectorAll(
        "input:not(:disabled), select:not(:disabled), textarea:not(:disabled)",
      ),
    ].find((control) => !control.checkValidity());

    if (invalidControl) {
      event.preventDefault();
      const invalidStep = getStep(invalidControl);

      if (invalidStep) showStep(invalidStep);

      invalidControl.reportValidity();
      invalidControl.focus();
      return;
    }

    if (submitting) {
      event.preventDefault();
      return;
    }

    submitting = true;
    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";
  });

  updateConditionals();

  // Preserve server-rendered validation feedback by opening its step.
  const initialStep = findServerErrorStep();

  // Enable wizard-specific styling only after successful initialization.
  root.classList.add("registration-wizard--enhanced");

  // In enhanced mode, the final submit button is shown only on step seven.
  showStep(initialStep, { focus: false });
})();